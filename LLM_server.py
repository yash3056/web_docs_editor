"""
To export it to executable file, run the following command:
```bash
pyinstaller --onefile --console --name LLM_server --hidden-import llama_cpp --collect-all llama_cpp --hidden-import PyPDF2 --add-data "security_analysis_prompt.txt;." LLM_server.py
```

Note: The --add-data flag ensures that the security_analysis_prompt.txt file is included in the executable.
After creating the executable, make sure both the LLM_server.exe and security_analysis_prompt.txt files are in the same directory.
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from llama_cpp import Llama
import json
import traceback
import PyPDF2
import io
import os
import sys
from typing import Optional

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

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

# --- PDF TEXT EXTRACTION ---
def extract_text_from_pdf(pdf_file: bytes) -> str:
    """
    Extracts text content from a PDF file using PyPDF2.
    
    Args:
        pdf_file: PDF file content as bytes
        
    Returns:
        str: Extracted text content from all pages, cleaned for consistency
    """
    try:
        # Create a file-like object from bytes
        pdf_stream = io.BytesIO(pdf_file)
        
        # Create PDF reader
        pdf_reader = PyPDF2.PdfReader(pdf_stream)
        
        # Extract text from all pages
        extracted_text = ""
        for page_num, page in enumerate(pdf_reader.pages):
            try:
                page_text = page.extract_text()
                if page_text.strip():  # Only add non-empty pages
                    # Don't add page headers to avoid classification differences
                    extracted_text += page_text
                    if page_num < len(pdf_reader.pages) - 1:  # Add separator between pages (except last page)
                        extracted_text += "\n"
            except Exception as page_error:
                print(f"Error extracting text from page {page_num + 1}: {page_error}")
        
        if not extracted_text.strip():
            return "No text content could be extracted from this PDF file. The document may contain only images or be password protected."
        
        # Clean up the extracted text to match document editor format
        cleaned_text = extracted_text.replace('\x00', '')  # Remove null characters
        cleaned_text = ' '.join(cleaned_text.split())  # Normalize whitespace and remove extra line breaks
        cleaned_text = cleaned_text.strip()
        
        print(f"Successfully extracted {len(cleaned_text)} characters from PDF")
        print(f"Cleaned text: '{cleaned_text}'")
        return cleaned_text
        
    except Exception as e:
        error_msg = f"Failed to extract text from PDF: {str(e)}"
        print(error_msg)
        return error_msg

# --- PROMPT ENGINEERING ---
def load_security_analysis_prompt() -> str:
    """
    Loads the security analysis prompt from an external text file.
    This allows the prompt to be edited without recompiling the executable.
    """
    # Get the directory where the script/executable is located
    if getattr(sys, 'frozen', False):
        # If running as compiled executable
        script_dir = os.path.dirname(sys.executable)
    else:
        # If running as script
        script_dir = os.path.dirname(os.path.abspath(__file__))
    
    prompt_file_path = os.path.join(script_dir, "security_analysis_prompt.txt")
    
    try:
        with open(prompt_file_path, 'r', encoding='utf-8') as file:
            prompt_template = file.read().strip()
        print(f"Successfully loaded prompt from: {prompt_file_path}")
        return prompt_template
    except FileNotFoundError:
        print(f"Warning: Prompt file not found at {prompt_file_path}. Using fallback prompt.")
        # Fallback to a basic prompt if file is missing
        return """You are an expert security analyst for the Indian Government. Analyze this document thoroughly and classify its security level based on official Indian Government security classification standards.

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
"""
    except Exception as e:
        print(f"Error loading prompt file: {e}. Using fallback prompt.")
        return "Analyze this document and provide security classification in JSON format. Analyze the uploaded document now:"

def create_security_analysis_prompt(document_content: str) -> str:
    """
    Constructs the detailed user-facing prompt for the security analysis task.
    This entire block will be treated as the 'user' message.
    """
    # Load the prompt template from external file
    prompt_template = load_security_analysis_prompt()
    
    # Append the document content to the prompt
    return prompt_template + "\n" + document_content

# --- API ENDPOINT ---
@app.post("/classify")
def classify_document(document: Document):
    """
    Receives a document, enables the model's "thinking" process,
    and returns a structured JSON classification.
    """
    # Print document content for debugging
    print(f"=== TEXT CLASSIFICATION ENDPOINT ===")
    print(f"Document content length: {len(document.content)} characters")
    print(f"Document content type: {type(document.content)}")
    print(f"Document content:\n'{document.content}'\n")
    print(f"Document content repr: {repr(document.content)}")
    print(f"=====================================")
    
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

# --- PDF CLASSIFICATION ENDPOINT ---
@app.post("/classify-pdf")
async def classify_pdf_document(file: UploadFile = File(...)):
    """
    Receives a PDF file, extracts text content, and returns a structured JSON classification.
    This endpoint handles PDF files directly and extracts their text content before classification.
    """
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    print(f"=== PDF CLASSIFICATION ENDPOINT ===")
    print(f"Received PDF file: {file.filename}")
    
    llm = get_llm_instance()
    if not llm:
        raise HTTPException(status_code=500, detail="Model not loaded. Check server logs for errors.")

    try:
        # Read the PDF file content
        pdf_content = await file.read()
        print(f"PDF file size: {len(pdf_content)} bytes")
        
        # Extract text from PDF
        extracted_text = extract_text_from_pdf(pdf_content)
        
        if not extracted_text or extracted_text.startswith("Failed to extract"):
            raise HTTPException(
                status_code=422, 
                detail="Could not extract text from PDF file. The file may be corrupted, password protected, or contain only images."
            )
        
        print(f"Extracted text length: {len(extracted_text)} characters")
        print(f"Extracted text type: {type(extracted_text)}")
        print(f"Full extracted text:\n'{extracted_text}'")
        print(f"Extracted text repr: {repr(extracted_text)}")
        print(f"=====================================")

        # 1. Define the components for the ChatML prompt format
        system_message = "You are a security classification assistant. First, think step-by-step about the user's request. Then, provide your final answer in the requested JSON format."
        user_prompt = create_security_analysis_prompt(extracted_text)

        # 2. Manually construct the full prompt with the <|thinking|> token
        full_prompt_with_thinking = (
            f"<|im_start|>system\n{system_message}<|im_end|>\n"
            f"<|im_start|>user\n{user_prompt}<|im_end|>\n"
            f"<|im_start|>assistant\n<|thinking|>"
        )
        
        print("--- Sending PDF Content to Model for Classification ---")
        print("-------------------------------------------------------")

        # 3. Use the direct completion call with the full formatted prompt
        response = llm(
            prompt=full_prompt_with_thinking,
            max_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.1,
            stop=["<|im_end|>"],
            echo=False
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
                # Add metadata about the PDF processing
                analysis['pdf_metadata'] = {
                    'filename': file.filename,
                    'file_size_bytes': len(pdf_content),
                    'extracted_text_length': len(extracted_text),
                    'extraction_successful': True
                }
                return analysis
            except json.JSONDecodeError as json_err:
                print(f"JSON Decode Error: {json_err}")
                print(f"Invalid JSON string received: {json_match}")
                # Fall through to the error response
        else:
            print("No valid JSON object found in the LLM response.")
            # Fall through to the error response

    except HTTPException:
        # Re-raise HTTP exceptions (like file validation errors)
        raise
    except Exception as e:
        print(f"Error during PDF classification: {e}")
        traceback.print_exc()

    finally:
        # Clean up the model instance to free memory
        if llm:
            del llm

    # Default error response if anything fails
    raise HTTPException(
        status_code=503,
        detail={
            "classification": "ANALYSIS_FAILED",
            "reasoning": "PDF classification failed. Could not parse a valid JSON response from the model after processing. Check server logs for details.",
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
