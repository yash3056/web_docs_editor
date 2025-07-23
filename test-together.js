require('dotenv').config();
const TogetherClassifier = require('./together-classifier');

async function testClassifier() {
    const apiKey = process.env.TOGETHER_API_KEY;
    
    if (!apiKey) {
        console.error('Please set TOGETHER_API_KEY in your .env file');
        return;
    }
    
    console.log('Testing Together AI classifier...');
    console.log('API Key:', apiKey.substring(0, 10) + '...');
    console.log('Model: deepseek-ai/DeepSeek-R1-0528');
    
    const classifier = new TogetherClassifier(apiKey);
    
    const testDocument = `
    This is a test document containing information about a government meeting.
    The meeting discussed budget allocations for the upcoming fiscal year.
    No sensitive information is contained in this document.
    `;
    
    try {
        console.log('\nClassifying test document...');
        const result = await classifier.classifyDocument(testDocument);
        
        console.log('\nClassification Result:');
        console.log('Classification:', result.classification);
        console.log('Confidence:', result.confidence);
        console.log('Reasoning:', result.reasoning);
        console.log('Key Risk Factors:', result.key_risk_factors);
        console.log('Analysis Timestamp:', result.analysis_timestamp);
        
    } catch (error) {
        console.error('Error testing classifier:', error);
    }
}

testClassifier();