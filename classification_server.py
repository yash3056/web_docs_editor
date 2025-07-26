"""
To export it to exectuable file, run the following command:
```bash
pyinstaller --onefile --console --name classification_server --hidden-import llama_cpp --collect-all llama_cpp classification_server.py
```
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from llama_cpp import Llama
import json
import traceback

app = FastAPI()

# --- CONFIGURATION ---
# IMPORTANT: Update this path to your local Qwen GGUF model
MODEL_FILENAME = "Qwen3-0.6B-Q4_K_M.gguf"
CONTEXT_SIZE = 32768 
MAX_OUTPUT_TOKENS = 2048 

# --- MODEL LOADING ---
def get_llm_instance():
    """
    Creates a fresh LLM instance.
    Adding chat_format='chatml' is crucial for Qwen models.
    """
    try:
        llm = Llama(
            model_path=MODEL_FILENAME,
            n_ctx=CONTEXT_SIZE,
            verbose=False,
            n_batch=512,
            # n_gpu_layers=-1,
            # This tells llama-cpp to correctly handle Qwen's special tokens
            chat_format="chatml",
        )
        return llm
    except Exception as e:
        print(f"FATAL: Error loading model from path: {MODEL_FILENAME}")
        print(f"Error details: {e}")
        return None

# --- Pydantic Model ---
class Document(BaseModel):
    content: str

class TextGenerationRequest(BaseModel):
    prompt: str
    context: str = ""

# --- PROMPT ENGINEERING ---
def create_security_analysis_prompt(document_content: str) -> str:
    """
    Constructs the detailed user-facing prompt for the security analysis task.
    This entire block will be treated as the 'user' message.
    """
    # This detailed prompt remains unchanged.
    return """
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
(List of analysis areas remains the same as in your original code)
1. STRATEGIC LOCATIONS & INFRASTRUCTURE
2. MILITARY & DEFENSE
3. PERSONNEL SECURITY
4. INTELLIGENCE & SURVEILLANCE
5. DIPLOMATIC & FOREIGN RELATIONS
6. ECONOMIC & STRATEGIC RESOURCES
7. CYBERSECURITY & COMMUNICATIONS
8. NUCLEAR & WMD

**ANALYSIS INSTRUCTIONS:**
- Examine ALL text content carefully
- Analyze ALL images, diagrams, maps, and visual content
- Look for coded or indirect references to sensitive information
- Consider cumulative impact of seemingly minor details
- Assess potential for intelligence gathering by adversaries
- Evaluate damage potential from unauthorized disclosure

**OUTPUT FORMAT:**
First, provide your step-by-step reasoning. Then, provide the final analysis in this exact JSON structure:
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
""" + document_content

# --- API ENDPOINT ---
@app.post("/classify")
def classify_document(document: Document):
    """
    Receives a document, enables the model's "thinking" process,
    and returns a structured JSON classification.
    """
    llm = get_llm_instance()
    if not llm:
        raise HTTPException(status_code=500, detail="Model not loaded. Check server logs for errors.")

    try:
        # 1. Define the components for the ChatML prompt format
        system_message = "You are a security classification assistant. First, think step-by-step about the user's request. Then, provide your final answer in the requested JSON format."
        user_prompt = create_security_analysis_prompt(document.content)

        # 2. Manually construct the full prompt with the <|thinking|> token
        # This is the key change to enable the model's reasoning process.
        full_prompt_with_thinking = (
            f"<|im_start|>system\n{system_message}<|im_end|>\n"
            f"<|im_start|>user\n{user_prompt}<|im_end|>\n"
            f"<|im_start|>assistant\n<|thinking|>"  # This special token triggers the thinking process
        )
        
        print("--- Sending Formatted Prompt to Model ---")
        # print(full_prompt_with_thinking) # Uncomment for full prompt debugging
        print("---------------------------------------")

        # 3. Use the direct completion call with the full formatted prompt
        # We no longer use create_chat_completion to have full control.
        response = llm(
            prompt=full_prompt_with_thinking,
            max_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.1,
            # Stop generation when the model finishes its turn.
            stop=["<|im_end|>"],
            echo=False  # Don't print the prompt in the output
        )
        
        response_text = response['choices'][0]['text'].strip()
        print(f"--- LLM Raw Output (including thinking) ---\n{response_text}\n-------------------------------------------")

        # 4. Extract the JSON object from the potentially verbose response
        start_index = response_text.find('{')
        end_index = response_text.rfind('}')

        if start_index != -1 and end_index != -1 and end_index > start_index:
            json_match = response_text[start_index:end_index+1]
            try:
                analysis = json.loads(json_match)
                return analysis
            except json.JSONDecodeError as json_err:
                print(f"JSON Decode Error: {json_err}")
                print(f"Invalid JSON string received: {json_match}")
                # Fall through to the error response
        else:
            print("No valid JSON object found in the LLM response.")
            # Fall through to the error response

    except Exception as e:
        print(f"Error during classification: {e}")
        traceback.print_exc() # Print full stack trace for better debugging

    finally:
        # Clean up the model instance to free memory
        if llm:
            del llm

    # Default error response if anything fails
    raise HTTPException(
        status_code=503,
        detail={
            "classification": "ANALYSIS_FAILED",
            "reasoning": "Classification failed. Could not parse a valid JSON response from the model after processing. Check server logs for details.",
            "raw_response": response_text if 'response_text' in locals() else "No response generated."
        }
    )

# --- TEXT GENERATION ENDPOINT ---
@app.post("/generate-text")
def generate_text(request: TextGenerationRequest):
    """
    Generates text content based on user prompt and context.
    This endpoint provides AI writing assistance functionality.
    """
    llm = get_llm_instance()
    if not llm:
        raise HTTPException(status_code=500, detail="Model not loaded. Check server logs for errors.")

    try:
        # Create a writing assistant prompt
        system_message = "You are a helpful writing assistant. Generate clear, coherent, and useful text based on the user's request. Keep responses concise but informative."
        
        # Combine user prompt with context if available
        user_prompt = f"Write about: {request.prompt}"
        if request.context:
            user_prompt += f"\n\nContext: {request.context}"
        
        user_prompt += "\n\nPlease provide a well-written response that addresses the request:"

        # Use ChatML format for the prompt
        full_prompt = (
            f"<|im_start|>system\n{system_message}<|im_end|>\n"
            f"<|im_start|>user\n{user_prompt}<|im_end|>\n"
            f"<|im_start|>assistant\n"
        )
        
        print(f"--- Generating text for prompt: {request.prompt} ---")
        
        # Generate response
        response = llm(
            prompt=full_prompt,
            max_tokens=500,  # Shorter responses for writing assistance
            temperature=0.7,  # More creative for writing
            stop=["<|im_end|>"],
            echo=False
        )
        
        response_text = response['choices'][0]['text'].strip()
        print(f"--- Generated text ---\n{response_text}\n-------------------")

        return {
            "generatedText": response_text,
            "prompt": request.prompt,
            "success": True
        }

    except Exception as e:
        print(f"Error during text generation: {e}")
        traceback.print_exc()
        
        # Return fallback response
        return {
            "generatedText": f"I'd be happy to help you write about {request.prompt}. Here's a starting point that you can expand upon and customize to fit your specific needs.",
            "prompt": request.prompt,
            "success": False,
            "error": str(e)
        }
    
    finally:
        # Clean up the model instance
        if llm:
            del llm

if __name__ == "__main__":
    import uvicorn
    # Make sure the model is available before starting the server
    if get_llm_instance() is None:
        print("\n--- Could not start server: Model failed to load. ---")
    else:
        print("\n--- Model loaded successfully. Starting server... ---")
        uvicorn.run(app, host="0.0.0.0", port=8000)
