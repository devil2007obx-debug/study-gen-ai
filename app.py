from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Attempt to import google.generativeai. If unavailable, set genai to None
# so the app falls back to mock behavior instead of erroring at import time.
try:
    import google.generativeai as genai
except Exception:
    genai = None

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Enable CORS so frontend (different port/domain if served statically) can access
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configure Gemini API
# It will automatically pick up GEMINI_API_KEY from .env
# If you don't have a key, the endpoints will return mock data or an error depending on how we handle it.
API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)
    # Use gemini-1.5-flash as it's the recommended default for text tasks
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = None

# Prompts mapped to features
PROMPTS = {
    "summary": "You are an AI study assistant. Please provide a concise, easy-to-understand summary of the following notes. Highlight the most important concepts.",
    "questions": "You are an expert tutor. Based on the following notes, generate 5-7 important questions that a student should be able to answer to show mastery of the topic.",
    "mcq": "Based on the provided notes, create a 5-question Multiple Choice Quiz (MCQ). Provide 4 options for each question (A, B, C, D) and specify the correct answer at the bottom.",
    "flashcards": "Create study flashcards from the given notes. Format them strictly as 'Front: [Question/Term]' and 'Back: [Answer/Definition]'. Provide 5-10 flashcards.",
    "explainer": "You are an expert teacher. Explain the core concepts of the following notes as simply as possible, using an analogy if helpful, as if you were explaining it to a beginner.",
    "plan": "Based on the length and content of the following notes, generate a practical 3-day study plan to master this material. Break it down day by day, suggesting what to read and review."
}

@app.route('/api/generate', methods=['POST'])
def generate():
    data = request.json
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400
        
    feature = data.get("feature", "")
    text = data.get("text", "")
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
        
    if feature not in PROMPTS:
        return jsonify({"error": "Invalid feature requested"}), 400
        
    system_instruction = PROMPTS[feature]
    full_prompt = f"{system_instruction}\n\nNotes Data:\n{text}"
    
    try:
        if model:
            # Call actual Gemini API
            response = model.generate_content(full_prompt)
            return jsonify({"result": response.text})
        else:
            # Fallback/Mock behavior for Hackathon if API Key is not set
            mock_result = f"**[MOCK DATA - No Gemini API Key provided in backend/.env]**\n\nHere is a generated response for **{feature}** based on the ~{len(text)} characters of notes you provided.\n\n"
            mock_result += "- This is simulated.\n- Configure `GEMINI_API_KEY` in `backend/.env` for real responses.\n- Content received: " + text[:50] + "..."
            return jsonify({"result": mock_result})
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run on default port 5000
    app.run(debug=True, port=5000)
