const Together = require('together-ai');

class TogetherClassifier {
    constructor(apiKey, model = 'deepseek-ai/DeepSeek-R1-0528') {
        this.client = new Together({
            apiKey: apiKey
        });
        this.model = model;
    }

    createSecurityAnalysisPrompt(documentContent) {
        return `You are an expert security analyst for the Indian Government. Analyze this document thoroughly and classify its security level based on official Indian Government security classification standards.

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

Analyze the following document content:

${documentContent}`;
    }

    async classifyDocument(documentContent) {
        try {
            console.log("Analyzing document with Together AI classifier...");

            // Ensure content is a string
            const contentString = Array.isArray(documentContent) 
                ? documentContent.join('\n') 
                : String(documentContent);

            // Strip HTML tags for better analysis
            const plainTextContent = contentString.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
            console.log("Cleaned content for analysis:", plainTextContent.substring(0, 200) + "...");

            const prompt = this.createSecurityAnalysisPrompt(plainTextContent);

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: "You are a security classification assistant that only outputs valid JSON responses for document classification."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 2048,
                temperature: 0.1,
                stream: false
            });

            const responseText = response.choices[0].message.content.trim();
            console.log("Together AI raw response:", responseText.substring(0, 500) + "...");

            // Extract JSON from the response
            const startIndex = responseText.indexOf('{');
            const endIndex = responseText.lastIndexOf('}');

            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                const jsonMatch = responseText.substring(startIndex, endIndex + 1);
                console.log("Extracted JSON:", jsonMatch.substring(0, 200) + "...");
                
                try {
                    const analysis = JSON.parse(jsonMatch);
                    
                    // Validate and add defaults for missing fields
                    const requiredFields = {
                        classification: "RESTRICTED",
                        confidence: 0.0,
                        reasoning: "Field missing from API response",
                        key_risk_factors: [],
                        sensitive_content: {},
                        potential_damage: "Unable to assess",
                        handling_recommendations: ["Manual review required"],
                        visual_analysis: {},
                        review_notes: ""
                    };

                    for (const [field, defaultValue] of Object.entries(requiredFields)) {
                        if (!(field in analysis)) {
                            analysis[field] = defaultValue;
                        }
                    }

                    analysis.analysis_timestamp = new Date().toISOString();
                    return analysis;

                } catch (jsonError) {
                    console.error("JSON Parse Error:", jsonError);
                    console.error("Invalid JSON string:", jsonMatch);
                    // Fall through to default response
                }
            } else {
                console.error("No valid JSON object found in the Together AI response.");
                // Fall through to default response
            }

        } catch (error) {
            console.error("Error during Together AI classification:", error.message);
            if (error.response) {
                console.error("Error response from Together AI:", error.response.data);
            }
            // Fall through to default response
        }

        // Return a default response in case of an error or no valid JSON
        return {
            classification: "RESTRICTED",
            confidence: 0.75,
            reasoning: "Classification failed. Could not parse a valid JSON response from the model.",
            key_risk_factors: ["ANALYSIS_FAILED"],
            sensitive_content: {},
            visual_analysis: {},
            potential_damage: "Unable to assess due to analysis failure",
            handling_recommendations: ["Manual review required immediately"],
            review_notes: "Analysis failed - manual review required",
            analysis_timestamp: new Date().toISOString()
        };
    }

    async addWatermarkToPdf(inputPath, outputPath, classification) {
        const fs = require('fs').promises;
        const { PDFDocument, rgb, degrees } = require('pdf-lib');

        try {
            const existingPdfBytes = await fs.readFile(inputPath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const pages = pdfDoc.getPages();

            const watermarkConfig = {
                'TOP SECRET': { color: rgb(1, 0, 0), opacity: 0.5 },
                'SECRET': { color: rgb(1, 0.5, 0), opacity: 0.5 },
                'CONFIDENTIAL': { color: rgb(1, 1, 0), opacity: 0.5 },
                'RESTRICTED': { color: rgb(0, 0, 1), opacity: 0.5 },
                'UNCLASSIFIED': { color: rgb(0, 0, 0), opacity: 0.3 }
            };

            const config = watermarkConfig[classification] || watermarkConfig['RESTRICTED'];

            for (const page of pages) {
                const { width, height } = page.getSize();
                const fontSize = width * 0.12;
                const textWidth = fontSize * classification.length * 0.6;
                const centerX = (width - textWidth) / 2;
                const centerY = height / 2;
                
                page.drawText(classification, {
                    x: centerX,
                    y: centerY,
                    size: fontSize,
                    color: config.color,
                    opacity: config.opacity,
                    rotate: degrees(45),
                });
            }

            const pdfBytes = await pdfDoc.save();
            await fs.writeFile(outputPath, pdfBytes);
            console.log(`Watermarked PDF saved to: ${outputPath}`);
        } catch (error) {
            console.error("Error adding watermark to PDF:", error);
            throw error;
        }
    }
}

module.exports = TogetherClassifier;