import express from 'express';
import { getLlama, LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';

// Model configuration
const MODEL_REPO = "unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF";
const MODEL_FILENAME = "DeepSeek-R1-Distill-Qwen-1.5B-BF16.gguf";
const CONTEXT_SIZE = 32768;

const app = express();
app.use(express.json());

// Global variable to store the llama instance
let llamaInstance = null;

// Function to get a fresh LLM instance
async function getLlmInstance() {
  try {
    // If we don't have a llama instance yet, create one
    if (!llamaInstance) {
      llamaInstance = await getLlama();
    }
    
    // Always create a fresh model and context for each request
    const model = await llamaInstance.loadModel({
      modelPath: path.join(process.cwd(), MODEL_FILENAME), // Adjust path as needed
      gpuLayers: -1, // Use all available GPU layers
    });
    const context = await model.createContext({
      contextSize: CONTEXT_SIZE,
      batchSize: 512,
    });
    return { model, context };
  } catch (e) {
    console.error(`Error loading model: ${e}`);
    return null;
  }
}

// Prompt creation function (unchanged)
function createSecurityAnalysisPrompt(documentContent) {
  return `
You are an expert security analyst for the Indian Government. Analyze this document thoroughly and classify its security level based on official Indian Government security classification standards.

**OFFICIAL INDIAN CLASSIFICATION LEVELS:**

🔴 **TOP SECRET**
   - Damage Criteria: Exceptionally grave damage to national security
   - Access Requirements: Joint Secretary level and above
   - Examples: Nuclear weapons details, highest level intelligence operations, critical defense strategies

🟠 **SECRET**
   - Damage Criteria: Serious damage or embarrassment to government
   - Access Requirements: Senior officials
   - Examples: Military operations, diplomatic negotiations, intelligence reports

🟡 **CONFIDENTIAL**
   - Damage Criteria: Damage or prejudice to national security
   - Access Requirements: Under-Secretary rank and above
   - Examples: Defense procurement, sensitive policy documents, operational plans

🔵 **RESTRICTED**
   - Damage Criteria: Official use only, no public disclosure
   - Access Requirements: Authorized officials
   - Examples: Internal government communications, administrative procedures, draft policies

⚪ **UNCLASSIFIED**
   - Damage Criteria: No security classification
   - Access Requirements: Public under RTI Act
   - Examples: Published reports, public announcements, general information

**CRITICAL ANALYSIS AREAS:**

1. **STRATEGIC LOCATIONS & INFRASTRUCTURE:**
   - Military installations, bases, airfields
   - Critical infrastructure (power plants, dams, ports)
   - Strategic geographical locations
   - Border areas and sensitive regions
   - Government facilities and secure locations

2. **MILITARY & DEFENSE:**
   - Troop movements and deployments
   - Weapons systems and specifications
   - Defense strategies and operational plans
   - Military equipment and capabilities
   - Intelligence operations

3. **PERSONNEL SECURITY:**
   - Government officials and their activities
   - Military and intelligence personnel
   - Diplomatic staff and missions
   - Security clearance information
   - Personal details of sensitive personnel

4. **INTELLIGENCE & SURVEILLANCE:**
   - Reconnaissance photographs
   - Satellite imagery
   - Communication intercepts
   - Intelligence gathering methods
   - Surveillance operations and targets

5. **DIPLOMATIC & FOREIGN RELATIONS:**
   - International negotiations
   - Foreign policy discussions
   - Diplomatic correspondence
   - Treaty negotiations
   - Relations with other nations

6. **ECONOMIC & STRATEGIC RESOURCES:**
   - Natural resources and reserves
   - Strategic economic information
   - Trade agreements and negotiations
   - Industrial capabilities
   - Technology transfers

7. **CYBERSECURITY & COMMUNICATIONS:**
   - Communication protocols
   - Encryption methods
   - Cybersecurity measures
   - IT infrastructure details
   - Network architectures

8. **NUCLEAR & WMD:**
   - Nuclear facilities and programs
   - Weapons of mass destruction
   - Nuclear security measures
   - Research and development programs
   - Safety and security protocols

**ANALYSIS INSTRUCTIONS:**
- Examine ALL text content carefully
- Analyze ALL images, diagrams, maps, and visual content
- Look for coded or indirect references to sensitive information
- Consider cumulative impact of seemingly minor details
- Assess potential for intelligence gathering by adversaries
- Evaluate damage potential from unauthorized disclosure

**OUTPUT FORMAT:**
Provide your analysis in this exact JSON structure:
{
    "classification": "CLASSIFICATION_LEVEL",
    "confidence": 0.95,
    "reasoning": "Detailed explanation of why this classification was chosen",
    "key_risk_factors": [
        "Specific sensitive elements identified"
    ],
    "sensitive_content": {
        "locations": ["Any strategic locations mentioned"],
        "personnel": ["Any sensitive personnel references"],
        "operations": ["Any operational details"],
        "technical": ["Any technical specifications"],
        "intelligence": ["Any intelligence-related content"]
    },
    "visual_analysis": {
        "maps_diagrams": ["Description of any sensitive visual content"],
        "photographs": ["Analysis of any photographs"],
        "technical_drawings": ["Any technical or architectural drawings"]
    },
    "potential_damage": "Assessment of potential damage from unauthorized disclosure",
    "handling_recommendations": [
        "Specific recommendations for document handling and distribution"
    ],
    "review_notes": "Additional notes for security review"
}

**IMPORTANT:** Be thorough and err on the side of caution. If in doubt between two classification levels, choose the higher one. Consider that seemingly innocent information might have intelligence value when combined with other sources.
Analyze the uploaded document now:
` + documentContent;
}

// POST endpoint for classification
app.post('/classify', async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ detail: 'Content is required' });
  }

  // Get a fresh model and context for this request
  const instance = await getLlmInstance();
  if (!instance) {
    return res.status(500).json({ detail: 'Failed to load model. Please check the model configuration.' });
  }

  const { model, context } = instance;
  let session = null;
  
  try {
    // Create a new chat session with the fresh context
    session = new LlamaChatSession({ contextSequence: context.getSequence() });
    const prompt = createSecurityAnalysisPrompt(content);

    let responseText;
    try {
      responseText = await session.prompt(prompt, {
        maxTokens: 1024,
        temperature: 0.1,
      });
      responseText = responseText.trim();
    } catch (chatErr) {
      console.error(`Chat completion failed: ${chatErr}. Trying regular completion...`);
      const response = await model.complete(prompt, {
        maxTokens: 1024,
        temperature: 0.8,
        systemPrompt: "You are a security classification assistant. Think step by step about the document, explain your reasoning, then output only valid JSON."
      });
      responseText = response.text.trim();
    }

    console.log(`LLM raw response: '${responseText}'`);

    // Extract JSON from response
    const startIndex = responseText.indexOf('{');
    const endIndex = responseText.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonMatch = responseText.slice(startIndex, endIndex + 1);
      console.log(`Extracted JSON: '${jsonMatch}'`);
      try {
        const analysis = JSON.parse(jsonMatch);
        return res.json(analysis);
      } catch (jsonErr) {
        console.error(`JSON Decode Error: ${jsonErr}`);
      }
    }
  } catch (e) {
    console.error(`Error during classification: ${e}`);
  } finally {
    // Always clean up resources
    if (session) session.dispose();
    if (context) context.dispose();
    if (model) model.dispose();
  }

  // Default response on error
  return res.json({
    classification: 'RESTRICTED',
    confidence: 0.75,
    reasoning: 'Classification failed. Could not parse a valid JSON response from the model.',
    key_risk_factors: ['ANALYSIS_FAILED'],
    sensitive_content: {},
    potential_damage: 'Unable to assess due to analysis failure',
    handling_recommendations: ['Manual review required immediately'],
  });
});

// Cleanup function to be called when server shuts down
process.on('SIGINT', async () => {
  console.log('Shutting down server and cleaning up resources...');
  if (llamaInstance) {
    try {
      await llamaInstance.dispose();
      console.log('Llama instance disposed successfully');
    } catch (err) {
      console.error('Error disposing llama instance:', err);
    }
  }
  process.exit(0);
});

// Start the server
const PORT = 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
