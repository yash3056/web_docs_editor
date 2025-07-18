# !pip install llama-cpp-python

from llama_cpp import Llama

llm = Llama.from_pretrained(
	repo_id="LiquidAI/LFM2-1.2B-GGUF",
	filename="LFM2-1.2B-F16.gguf",
	n_ctx=8192  # Set context length to 8k tokens
)

prompt = """You are an expert security analyst for the Indian Government. Analyze this document thoroughly and classify its security level based on official Indian Government security classification standards.

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

Document Content: I am planning to attack """

response = llm.create_chat_completion(
	messages = [
		{
			"role": "user",
			"content": prompt
		}
	]
)

print(response['choices'][0]['message']['content'])

