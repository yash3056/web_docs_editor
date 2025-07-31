# Security Analysis Prompt Configuration

## Overview
The security analysis prompt has been externalized to `security_analysis_prompt.txt` to allow easy editing without recompiling the executable.

## Files
- `LLM_server.py` - Main Python script
- `security_analysis_prompt.txt` - Configurable prompt template
- `LLM_server.exe` - Compiled executable (after PyInstaller build)

## Usage

### Running as Python Script
1. Ensure both `LLM_server.py` and `security_analysis_prompt.txt` are in the same directory
2. Run: `python LLM_server.py`

### Running as Executable
1. Build the executable using PyInstaller:
   ```bash
   pyinstaller --onefile --console --name LLM_server --hidden-import llama_cpp --collect-all llama_cpp --hidden-import PyPDF2 --add-data "security_analysis_prompt.txt;." LLM_server.py
   ```
2. After building, ensure both `LLM_server.exe` and `security_analysis_prompt.txt` are in the same directory
3. Run: `LLM_server.exe`

## Editing the Prompt
1. Open `security_analysis_prompt.txt` in any text editor
2. Modify the prompt as needed
3. Save the file
4. Restart the server (no recompilation needed)

## Fallback Behavior
If the `security_analysis_prompt.txt` file is missing or cannot be read, the system will:
1. Print a warning message
2. Use a basic fallback prompt to ensure the server continues working
3. Log the error for debugging

## Important Notes
- The prompt file must be in UTF-8 encoding
- The document content will be automatically appended to the end of the prompt
- Keep the JSON output format requirements in the prompt for proper functionality
