from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from llama_cpp import Llama
import json

app = FastAPI()

# TODO: Update this path to your local model
# Model configuration
MODEL_REPO = "ggml-org/gemma-3-1b-it-GGUF"
MODEL_FILENAME = "gemma-3-1b-it-f16.gguf"
CONTEXT_SIZE = 32768

# Don't load the model globally - we'll create a new instance for each request
def get_llm_instance():
    """Create a fresh LLM instance to avoid state carryover between requests"""
    try:
        llm = Llama.from_pretrained(
            repo_id=MODEL_REPO,
            filename=MODEL_FILENAME,
            n_ctx=CONTEXT_SIZE,
            verbose=False,
            # seed=0,  # Fixed seed for reproducibility
            n_batch=512,  # Smaller batch size
            last_n_tokens_size=64  # Reduce context tracking
        )
        return llm
    except Exception as e:
        print(f"Error loading model: {e}")
        return None

class Document(BaseModel):
    content: str

def create_security_analysis_prompt(document_content):
    return f'''
You are an expert security analyst for the Indian Government. Analyze this document thoroughly and classify its security level based on official Indian Government security classification standards.

**OFFICIAL INDIAN CLASSIFICATION LEVELS:**



 **TOP SECRET**
   - Damage Criteria: Exceptionally grave damage to national security
   - Access Requirements: Joint Secretary level and above
   - Examples: Nuclear weapons details, highest level intelligence operations, critical defense strategies

 **SECRET**
   - Damage Criteria: Serious damage or embarrassment to government
   - Access Requirements: Senior officials
   - Examples: Military operations, diplomatic negotiations, intelligence reports

 **CONFIDENTIAL**
   - Damage Criteria: Damage or prejudice to national security
   - Access Requirements: Under-Secretary rank and above
   - Examples: Defense procurement, sensitive policy documents, operational plans

 **RESTRICTED**
   - Damage Criteria: Official use only, no public disclosure
   - Access Requirements: Authorized officials
   - Examples: Internal government communications, administrative procedures, draft policies

 **UNCLASSIFIED**
   - Damage Criteria: No security classification
   - Access Requirements: Public under RTI Act
   - Examples: Published reports, public announcements, general information

**CRITICAL ANALYSIS AREAS:**

1. **STRATEGIC LOCATIONS & INFRASTRUCTURE:** Military installations, bases, airfields, critical infrastructure
2. **MILITARY & DEFENSE:** Troop movements, weapons systems, defense strategies
3. **PERSONNEL SECURITY:** Government officials, military personnel, security clearances
4. **INTELLIGENCE & SURVEILLANCE:** Reconnaissance, satellite imagery, intelligence operations
5. **DIPLOMATIC & FOREIGN RELATIONS:** International negotiations, foreign policy
6. **ECONOMIC & STRATEGIC RESOURCES:** Natural resources, strategic economic information
7. **CYBERSECURITY & COMMUNICATIONS:** Communication protocols, encryption methods
8. **NUCLEAR & WMD:** Nuclear facilities, weapons of mass destruction

**OUTPUT FORMAT:**
Provide your analysis in this exact JSON structure:
{{
    "classification": "CLASSIFICATION_LEVEL",
    "confidence": 0.95,
    "reasoning": "Detailed explanation of why this classification was chosen",
    "key_risk_factors": ["Specific sensitive elements identified"],
    "sensitive_content": {{
        "locations": ["Any strategic locations mentioned"],
        "personnel": ["Any sensitive personnel references"],
        "operations": ["Any operational details"],
        "technical": ["Any technical specifications"],
        "intelligence": ["Any intelligence-related content"]
    }},
    "potential_damage": "Assessment of potential damage from unauthorized disclosure",
    "handling_recommendations": ["Specific recommendations for document handling and distribution"]
}}

**IMPORTANT:** Be thorough and err on the side of caution. If in doubt between two classification levels, choose the higher one.

Analyze the document content:

Document Content:
{document_content}
'''

@app.post("/classify")
def classify_document(document: Document):
    # Get a fresh model instance for this request
    llm = get_llm_instance()
    if not llm:
        raise HTTPException(status_code=500, detail="Failed to load model. Please check the model configuration.")

    content = document.content
    prompt = create_security_analysis_prompt(content)
    
    try:
        # Reset the model's KV cache to ensure no state is carried over
        llm.reset()
        
        # Use a more robust approach with completion instead of chat completion
        try:
            # First try with chat completion
            response = llm.create_chat_completion(
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a security classification assistant that only outputs valid JSON."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                max_tokens=1024,  # Limit output tokens
                temperature=0.1,  # More deterministic output
                stream=False      # Ensure we get complete response
            )
            response_text = response['choices'][0]['message']['content'].strip() # type: ignore
        except Exception as chat_err:
            print(f"Chat completion failed: {chat_err}. Trying regular completion...")
            # Fallback to regular completion
            llm.reset()  # Reset again before trying a different approach
            response = llm(prompt, max_tokens=1024, temperature=0.1, echo=False)
            response_text = response['choices'][0]['text'].strip() # type: ignore
            
        print(f"LLM raw response: '{response_text}'")

        # Extract JSON from the response
        start_index = response_text.find('{')
        end_index = response_text.rfind('}')

        if start_index != -1 and end_index != -1 and end_index > start_index:
            json_match = response_text[start_index:end_index+1]
            print(f"Extracted JSON: '{json_match}'")
            try:
                analysis = json.loads(json_match)
                
                # Clean up resources before returning
                try:
                    del llm
                except:
                    pass
                    
                return analysis
            except json.JSONDecodeError as json_err:
                print(f"JSON Decode Error: {json_err}")
                print(f"Invalid JSON string: {json_match}")
                # Fall through to default response
        else:
            print("No valid JSON object found in the LLM response.")
            # Fall through to default response

    except Exception as e:
        print(f"Error during classification: {e}")
        import traceback
        traceback.print_exc()  # Print full stack trace for better debugging

    # Clean up resources
    if llm:
        try:
            del llm
        except:
            pass
            
    # Return a default response in case of an error or no valid JSON
    return {
        "classification": "RESTRICTED",
        "confidence": 0.75,
        "reasoning": "Classification failed. Could not parse a valid JSON response from the model.",
        "key_risk_factors": ["ANALYSIS_FAILED"],
        "sensitive_content": {},
        "potential_damage": "Unable to assess due to analysis failure",
        "handling_recommendations": ["Manual review required immediately"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)