// View Switching Logic
function showAppView() {
  document.getElementById('landing-view').classList.remove('active');
  document.getElementById('landing-view').classList.add('hidden');

  document.getElementById('app-view').classList.remove('hidden');
  document.getElementById('app-view').classList.add('active');

  // Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLandingView() {
  document.getElementById('app-view').classList.remove('active');
  document.getElementById('app-view').classList.add('hidden');

  document.getElementById('landing-view').classList.remove('hidden');
  document.getElementById('landing-view').classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startMCQTest() {
  showAppView();

  // Remove active class from all regular tabs since we are taking a dedicated test
  const allTabs = document.querySelectorAll('.tab-btn');
  allTabs.forEach(t => t.classList.remove('active-tab'));

  // Set current feature
  currentFeature = 'mcq';

  // Update generate button text
  const genBtn = document.getElementById('generate-btn');
  if (genBtn) {
    genBtn.innerHTML = `<span class="btn-icon">✨</span> Generate Quiz`;
  }
}

// Global state tracking
let currentFeature = 'plan'; // Default active tab in screenshot
const featureTitles = {
  'summary': 'Generated Summary',
  'questions': 'Important Questions',
  'mcq': 'MCQ Quiz',
  'flashcards': 'Flashcards',
  'explainer': 'Topic Explanation',
  'plan': 'Generated Study Plan'
};

const featureBtnText = {
  'summary': 'Generate Summary',
  'questions': 'Generate Questions',
  'mcq': 'Generate Quiz',
  'flashcards': 'Generate Flashcards',
  'explainer': 'Explain Topic',
  'plan': 'Generate Planner'
};

// Prompts for AI directly matched to features (Moved from backend)
const PROMPTS = {
  "summary": "You are an AI study assistant. Please provide a concise, easy-to-understand summary of the following notes. Highlight the most important concepts.",
  "questions": "You are an expert tutor. Based on the following notes, generate 5-7 important questions that a student should be able to answer to show mastery of the topic.",
  "mcq": "Based on the provided notes, create a 20-question Multiple Choice Quiz (MCQ). Provide exactly 20 questions. For each question, strictly use this exact format:\nQ: [Question]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\nAnswer: [A, B, C, or D]",
  "flashcards": "Create study flashcards from the given notes. Format them strictly as 'Front: [Question/Term]' and 'Back: [Answer/Definition]'. Provide 5-10 flashcards.",
  "explainer": "You are an expert teacher. Explain the core concepts of the following notes as simply as possible, using an analogy if helpful, as if you were explaining it to a beginner.",
  "plan": "Based on the length and content of the following notes, generate a practical 3-day study plan to master this material. Break it down day by day, suggesting what to read and review."
};

// =======================================================
// 🔴 IMPORTANT: YOUR GEMINI API KEY GOES HERE
// =======================================================
// We moved the logic to the frontend so you don't need Python to run the app!
// The key you provided was returning an error. Please paste your working key here.
const GEMINI_API_KEY = 'AIzaSyA8FlyD7R4KdlauJUAUqHYZfaH6ksmpn4Q';
// =======================================================

// State for attached generic file directly appended to API call
let attachedFileInlineData = null;

// DOM Elements
const textarea = document.getElementById('notes-input');
const charCount = document.getElementById('char-count');
const generateBtn = document.getElementById('generate-btn');
const tabs = document.querySelectorAll('.tab-btn');
const resultsCard = document.getElementById('results-card');
const resultsTitle = document.getElementById('results-title');
const aiResponseDiv = document.getElementById('ai-response');
const loadingState = document.getElementById('loading-state');
const fileUpload = document.getElementById('file-upload');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');

// Character counter
textarea.addEventListener('input', () => {
  const count = textarea.value.length;
  charCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
});

// Tab switching logic
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active class from all
    tabs.forEach(t => t.classList.remove('active-tab'));
    // Add to clicked
    tab.classList.add('active-tab');

    // Update state
    currentFeature = tab.dataset.feature;

    // Update generate button text
    generateBtn.innerHTML = `<span class="btn-icon">✨</span> ${featureBtnText[currentFeature]}`;
  });
});

// Generate button logic (Fetch to Backend)
generateBtn.addEventListener('click', async () => {
  const text = textarea.value.trim();

  // Fix Phantom Attachment Bug: Check if [Embedded File...] is actually still in the text area
  if (attachedFileInlineData && !text.includes('[Embedded File:')) {
    attachedFileInlineData = null;
    console.log('User cleared embedded file placeholder. Nullifying attachment.');
  }

  if (!text && !attachedFileInlineData) {
    alert("Please paste some notes or upload a document first!");
    return;
  }

  // Show Results Card with Loading State
  resultsCard.classList.remove('hidden');
  resultsTitle.textContent = featureTitles[currentFeature];
  aiResponseDiv.innerHTML = ''; // clear previous
  loadingState.classList.remove('hidden');

  // Disable button to prevent multiple clicks
  generateBtn.disabled = true;
  generateBtn.style.opacity = '0.7';

  try {
    // API Call Directly to Gemini API (Bypassing Python Backend)
    const systemPrompt = PROMPTS[currentFeature];
    const fullPrompt = `${systemPrompt}\n\nNotes Data:\n${text}`;

    // Prepare API parts array, accommodating any attached file
    const apiParts = [{ text: fullPrompt }];
    if (attachedFileInlineData) {
      apiParts.push({
        inline_data: attachedFileInlineData
      });
    }

    // Pre-declare AI list for Fallback System
    const fallbackModels = [
      'gemini-2.5-flash',
      'gemini-1.5-flash'
    ];

    let response = null;
    let data = null;
    let successfulModel = null;

    // Loop through fallback AI models automatically if one fails over high traffic
    for (const model of fallbackModels) {
      try {
        console.log(`Attempting API using ${model}...`);

        // Give UI feedback on which engine is currently processing
        const loaderText = loadingState.querySelector('p');
        if (loaderText) loaderText.textContent = `AI is bouncing to engine: ${model}...`;

        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: apiParts
            }]
          })
        });

        data = await response.json();

        // If the AI successfully generated a response, lock it in and exit loop!
        if (response.ok) {
          successfulModel = model;
          break;
        } else {
          const errorMsg = data.error ? data.error.message : 'Unknown Error';
          console.warn(`AI Model ${model} failed to generate. Trying next...`, errorMsg);
          const lowerMsg = errorMsg.toLowerCase();

          // Stop bouncing completely if API Key is invalid OR if Quota is exhausted (Global limit)
          if (lowerMsg.includes('api key not valid') || lowerMsg.includes('quota') || lowerMsg.includes('exhausted')) {
            break;
          }
        }
      } catch (err) {
        console.warn(`Network failure attempting ${model}`, err);
        // Let it silently roll over to next model on network flakiness
      }
    }

    loadingState.classList.add('hidden');

    if (response && response.ok && data) {
      // Extract text from Gemini response structure
      const generatedText = data.candidates[0].content.parts[0].text;

      if (currentFeature === 'flashcards' && (generatedText.toLowerCase().includes('front:') || generatedText.toLowerCase().includes('question:'))) {
        let flashcardHtml = '<div class="flashcards-grid">';
        // Match Front/Question: ... Back/Answer: ... flexibly
        const flashcardRegex = /(?:Front|Question):\s*(.*?)\s*(?:Back|Answer):\s*(.*?)(?=(?:Front|Question):|$)/gis;
        let match;
        let count = 0;

        while ((match = flashcardRegex.exec(generatedText)) !== null) {
          count++;
          // Clean up leading/trailing and rogue asterisks
          let frontText = match[1].trim().replace(/^\*\*|\*\*$/g, '');
          let backText = match[2].trim().replace(/^\*\*|\*\*$/g, '');

          flashcardHtml += `
            <div class="flashcard" onclick="this.classList.toggle('flipped')">
              <div class="flashcard-inner">
                <div class="flashcard-front">
                  <span class="flashcard-label">Click to flip</span>
                  <p>${frontText}</p>
                </div>
                <div class="flashcard-back">
                  <span class="flashcard-label">Answer</span>
                  <p>${backText}</p>
                </div>
              </div>
            </div>
          `;
        }
        flashcardHtml += '</div>';

        if (count > 0) {
          aiResponseDiv.innerHTML = `<p>Here are your successfully generated study flashcards!</p>${flashcardHtml}`;
        } else {
          aiResponseDiv.innerHTML = `<p>${generatedText.replace(/\n/g, '<br>')}</p>`;
        }
      } else if (currentFeature === 'mcq' && generatedText.includes('Q:')) {
        let mcqHtml = '<div class="mcq-test-container" id="mcq-test-form"><p>Select your answers and click Submit below!</p>';
        const mcqRegex = /Q:\s*(.*?)\s*A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Answer:\s*([A-D])/gis;
        let match;
        let qCount = 0;

        while ((match = mcqRegex.exec(generatedText)) !== null) {
          qCount++;
          const question = match[1].trim().replace(/^\*\*|\*\*$/g, '');
          const optA = match[2].trim();
          const optB = match[3].trim();
          const optC = match[4].trim();
          const optD = match[5].trim();
          const ans = match[6].trim().toUpperCase();

          mcqHtml += `
            <div class="mcq-question-block" data-answer="${ans}" style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #eee;">
              <h4 style="margin-top:0;">${qCount}. ${question}</h4>
              <label class="mcq-option" data-letter="A" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="q${qCount}" value="A"> A) ${optA}</label>
              <label class="mcq-option" data-letter="B" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="q${qCount}" value="B"> B) ${optB}</label>
              <label class="mcq-option" data-letter="C" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="q${qCount}" value="C"> C) ${optC}</label>
              <label class="mcq-option" data-letter="D" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="q${qCount}" value="D"> D) ${optD}</label>
            </div>
          `;
        }

        if (qCount > 0) {
          mcqHtml += `<button class="btn-primary" onclick="window.gradeMCQTest()" style="margin-top:10px;">Submit Test</button>`;
          mcqHtml += `<div id="mcq-score-display" style="margin-top:15px; font-weight:bold; font-size:1.2rem;"></div></div>`;
          aiResponseDiv.innerHTML = mcqHtml;
        } else {
          aiResponseDiv.innerHTML = `<p>${generatedText.replace(/\n/g, '<br>')}</p>`;
        }
      } else {
        // Basic markdown to HTML parsing (for hackathon purposes)
        let formattedHtml = generatedText
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n\*/g, '<br>•')
          .replace(/\n-/g, '<br>-')
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>');

        aiResponseDiv.innerHTML = `<p>${formattedHtml}</p>`;
      }
    } else {
      // Handle known API errors gracefully
      const errorMsg = (data && data.error) ? data.error.message : 'Unknown API or Network Error. Please check console.';

      if (errorMsg.toLowerCase().includes('high demand') || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('exhausted')) {
        // High Demand / Quota Fallback - PERFECT for hackathon demos!
        let mockContent = '';
        if (currentFeature === 'mcq') {
          mockContent = `
             <div class="mcq-test-container">
             <div class="mcq-question-block" data-answer="B" style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #eee;">
              <h4 style="margin-top:0;">1. What is the primary purpose of a Database Management System?</h4>
              <label class="mcq-option" data-letter="A" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="mockq1" value="A"> A) To create web pages</label>
              <label class="mcq-option" data-letter="B" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="mockq1" value="B"> B) To store and retrieve data efficiently</label>
              <label class="mcq-option" data-letter="C" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="mockq1" value="C"> C) To design UI graphics</label>
              <label class="mcq-option" data-letter="D" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="mockq1" value="D"> D) To compile code</label>
             </div>
             <div class="mcq-question-block" data-answer="D" style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #eee;">
              <h4 style="margin-top:0;">2. Which artificial intelligence concept involves neural networks imitating the human brain?</h4>
              <label class="mcq-option" data-letter="A" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="mockq2" value="A"> A) Hardcoding logic</label>
              <label class="mcq-option" data-letter="B" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="mockq2" value="B"> B) Recursion</label>
              <label class="mcq-option" data-letter="C" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="mockq2" value="C"> C) Object Oriented Programming</label>
              <label class="mcq-option" data-letter="D" style="display:block; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:6px; cursor:pointer;"><input type="radio" name="mockq2" value="D"> D) Deep Learning</label>
             </div>
             <button class="btn-primary" onclick="window.gradeMCQTest()" style="margin-top:10px;">Submit Test</button>
             <div id="mcq-score-display" style="margin-top:15px; font-weight:bold; font-size:1.2rem;"></div>
             </div>
           `;
        } else {
          mockContent = `
             <p>Here is a generated <strong>${featureTitles[currentFeature]}</strong> based on your notes:</p>
             <ul>
               <li><strong>Day 1:</strong> Read through the core concepts and understand the terminology.</li>
               <li><strong>Day 2:</strong> Practice with flashcards and answer the generated questions.</li>
               <li><strong>Day 3:</strong> Take the MCQ Quiz to test your final mastery before the exam!</li>
             </ul>
           `;
        }

        aiResponseDiv.innerHTML = `
          <div style="background: rgba(255,200,0,0.1); padding: 1rem; border-left: 4px solid orange; border-radius: 4px; margin-bottom: 1rem;">
            <strong>⚠️ Google API Overloaded (Or Rate Limited)</strong><br>
            <span style="font-size: 0.85em; color: #d68911;">Google's Gemini AI servers are currently experiencing high demand or your key hit a quota. We are showing a cached/mock response so you can still preview the app features!</span>
          </div>
          ${mockContent}
        `;
      } else {
        // Other API errors (Invalid Key, etc.)
        aiResponseDiv.innerHTML = `
          <div style="background: rgba(255,100,100,0.1); padding: 1rem; border-left: 4px solid red; border-radius: 4px; margin-bottom: 1rem;">
            <strong>API Error:</strong> Google Gemini API rejected the request.<br>
            <span style="font-size: 0.85em; color: #a00;">Details: ${errorMsg}</span>
          </div>
        `;
      }
    }
  } catch (error) {
    loadingState.classList.add('hidden');
    aiResponseDiv.innerHTML = `
      <div style="background: rgba(255,100,100,0.1); padding: 1rem; border-left: 4px solid red; border-radius: 4px; margin-bottom: 1rem;">
        <strong>Network Error:</strong> Failed to fetch from Google APIs. Are you connected to the internet?<br>
        <span style="font-size: 0.85em; color: #a00;">Error details: ${error.message}</span>
      </div>
    `;
    console.error("Fetch Error:", error);
  } finally {
    generateBtn.disabled = false;
    generateBtn.style.opacity = '1';

    // Smooth scroll to results
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

// Function to dynamically load PDF.js only when needed for massive performance gains
async function loadPdfJs() {
  if (typeof window.pdfjsLib !== 'undefined') return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function extractTextFromPDF(file) {
  await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    text += pageText + '\n';
  }
  return text;
}

// File upload handler listener
fileUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    // Reset any previous non-text attachment
    attachedFileInlineData = null;

    if (file.type === 'application/pdf') {
      try {
        textarea.value = `Extracting text from ${file.name}, please wait...`;
        textarea.disabled = true;

        const extractedText = await extractTextFromPDF(file);

        if (extractedText.trim().length === 0) {
          textarea.value = `Could not extract text from ${file.name}. It might be an image-based PDF.`;
        } else {
          textarea.value = extractedText;
        }
      } catch (error) {
        console.error('PDF extraction error:', error);
        textarea.value = `Error extracting text from ${file.name}: ${error.message}`;
      } finally {
        textarea.disabled = false;
        textarea.dispatchEvent(new Event('input')); // trigger char count update
      }
    } else {
      // For text files
      const isTextFile = file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.csv');

      textarea.value = `Attaching ${file.name}, please wait...`;
      textarea.disabled = true;

      if (isTextFile) {
        const reader = new FileReader();
        reader.onload = function (event) {
          textarea.value = event.target.result;
          textarea.disabled = false;
          textarea.dispatchEvent(new Event('input'));
        };
        reader.readAsText(file);
      } else {
        // Validate MIME type. Gemini inlineData supports images, audio, and video.
        // Document formats like docx/pptx are rejected unless using the advanced File API.
        const fileType = file.type || '';
        const isSupportedMultimodal = fileType.startsWith('image/') ||
          fileType.startsWith('audio/') ||
          fileType.startsWith('video/');

        if (!isSupportedMultimodal) {
          textarea.value = `Unsupported file type: ${file.name}\n\nThe AI currently supports PDF, Text (.txt, .md, .csv), Images, Audio, and Video files. \n\nFor Word (.docx) or PowerPoint (.pptx), please 'Save As PDF' first or copy-paste directly here!`;
          textarea.disabled = false;
          textarea.dispatchEvent(new Event('input'));
          return;
        }

        // Assume multimodal content (image, etc.) and convert to base64 for inline_data
        const reader = new FileReader();
        reader.onload = function (event) {
          const base64Data = event.target.result.split(',')[1];
          attachedFileInlineData = {
            mime_type: file.type || 'application/octet-stream',
            data: base64Data
          };
          textarea.value = `[Embedded File: ${file.name}]\n\nFile attached successfully! AI will analyze its content. You can drop additional instructions here...`;
          textarea.disabled = false;
          textarea.dispatchEvent(new Event('input'));
        };
        reader.onerror = function () {
          textarea.value = `Failed to process ${file.name}. Ensure it's not corrupted.`;
          textarea.disabled = false;
          textarea.dispatchEvent(new Event('input'));
        };
        reader.readAsDataURL(file);
      }
    }
  }
});

// Copy to clipboard functionality
copyBtn.addEventListener('click', () => {
  const content = aiResponseDiv.innerText;
  if (!content) return;

  navigator.clipboard.writeText(content).then(() => {
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '✅';
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    alert('Failed to copy text.');
  });
});

// Download Notes as TXT functionality
// Since PDF generation requires external libraries like jspdf on frontend, 
// using a simple TXT download for the hackathon is more robust and requires 0 configuration.
downloadBtn.addEventListener('click', () => {
  const content = aiResponseDiv.innerText;
  if (!content) return;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `StudyGen_${currentFeature}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Grading Logic for MCQ Tests
window.gradeMCQTest = function () {
  const blocks = document.querySelectorAll('.mcq-question-block');
  let score = 0;

  blocks.forEach(block => {
    const correctAns = block.dataset.answer;
    const selected = block.querySelector('input[type="radio"]:checked');

    // Reset colors
    block.querySelectorAll('.mcq-option').forEach(opt => {
      opt.style.backgroundColor = 'transparent';
      opt.style.borderColor = '#ddd';
    });

    if (selected) {
      if (selected.value === correctAns) {
        score++;
        selected.closest('.mcq-option').style.backgroundColor = '#e6f4ea'; // light green
        selected.closest('.mcq-option').style.borderColor = '#34a853';
      } else {
        selected.closest('.mcq-option').style.backgroundColor = '#fce8e6'; // light red
        selected.closest('.mcq-option').style.borderColor = '#ea4335';
        // highlight correct one too
        const correctOpt = block.querySelector(`.mcq-option[data-letter="${correctAns}"]`);
        if (correctOpt) {
          correctOpt.style.backgroundColor = '#e6f4ea';
          correctOpt.style.borderColor = '#34a853';
        }
      }
    } else {
      // Did not answer, just highlight the correct one
      const correctOpt = block.querySelector(`.mcq-option[data-letter="${correctAns}"]`);
      if (correctOpt) {
        correctOpt.style.backgroundColor = '#e6f4ea';
        correctOpt.style.borderColor = '#34a853';
      }
    }
  });

  const scoreDisplay = document.getElementById('mcq-score-display');
  if (scoreDisplay) {
    scoreDisplay.innerHTML = `Your Score: ${score} / ${blocks.length} 🌟
      <button class="btn-primary" id="analytics-btn" style="margin-left: 15px; padding: 0.5rem 1rem; font-size: 0.95rem; display: inline-flex;" onclick="window.getMCQAnalytics()">🧠 Analyze Weak Points</button>
      <div id="analytics-results" style="margin-top: 20px; font-weight: normal; font-size: 1.05rem; line-height: 1.6;"></div>`;
  }
};

window.getMCQAnalytics = async function () {
  const blocks = document.querySelectorAll('.mcq-question-block');
  const analyticsBtn = document.getElementById('analytics-btn');
  const analyticsResults = document.getElementById('analytics-results');

  if (!analyticsBtn || !analyticsResults) return;

  let wrongQuestionsText = [];

  blocks.forEach((block) => {
    const correctAns = block.dataset.answer;
    const selected = block.querySelector('input[type="radio"]:checked');
    const questionText = block.querySelector('h4').innerText;

    if (!selected || selected.value !== correctAns) {
      const correctText = block.querySelector(`.mcq-option[data-letter="${correctAns}"]`).innerText;
      let userText = "Did not answer";
      if (selected) {
        userText = block.querySelector(`.mcq-option[data-letter="${selected.value}"]`).innerText;
      }
      wrongQuestionsText.push(`Question: ${questionText}\nUser chose: ${userText}\nCorrect answer: ${correctText}`);
    }
  });

  if (wrongQuestionsText.length === 0) {
    analyticsResults.innerHTML = `<div style="padding:15px; background:#e6f4ea; border:1px solid #34a853; border-radius:8px; color:#137333;"><strong>Excellent work!</strong> You got a perfect score, so there are no weak points to analyze. Keep it up!</div>`;
    return;
  }

  analyticsBtn.disabled = true;
  analyticsBtn.style.opacity = '0.7';
  analyticsBtn.innerText = "Analyzing...";
  analyticsResults.innerHTML = `<div class="loading-state" style="padding:1rem 0;"><div class="spinner" style="width:25px; height:25px; border-width:3px;"></div><p style="margin-top:10px;">AI is analyzing your weak points...</p></div>`;

  const promptText = `You are an expert tutor. A student took a multiple-choice quiz and got the following questions wrong:\n\n${wrongQuestionsText.join('\n\n')}\n\nBased on these incorrect answers, please provide a concise analysis of their weak points followed by actionable study advice to help them understand these concepts better. Give the output in Markdown format.`;

  try {
    const fallbackModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let response = null;
    let data = null;

    for (const model of fallbackModels) {
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });
        data = await response.json();
        if (response.ok) break;
      } catch (e) {
        console.warn('Analytics fetch error:', e);
      }
    }

    if (response && response.ok && data) {
      const generatedText = data.candidates[0].content.parts[0].text;
      let formattedHtml = generatedText
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n\*/g, '<br>•')
        .replace(/\n-/g, '<br>-')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>');

      analyticsResults.innerHTML = `<div style="padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; display:block; animation: fadeIn 0.5s ease-in-out;"><h3 style="margin-top:0; margin-bottom:15px; color:var(--primary-color);">🧠 AI Assessment of Weak Points</h3><p>${formattedHtml}</p></div>`;
    } else {
      analyticsResults.innerHTML = `<div style="padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;"><div style="color:orange; margin-bottom:10px; font-weight:bold;">⚠️ Using Mock Analysis (API limits reached)</div><p>Based on your missed questions, it looks like you need to review the core definitions and fundamentals. Try to break down complex topics into smaller sections and use the flashcards feature to memorize key terms before attempting the quiz again!</p></div>`;
    }
  } catch (err) {
    analyticsResults.innerHTML = `<div style="color:red; padding:15px; border:1px solid red; border-radius:8px;">Error analyzing weak points. Please check your internet connection and try again.</div>`;
    console.error(err);
  } finally {
    analyticsBtn.innerHTML = "🧠 Analyze Weak Points";
    analyticsBtn.disabled = false;
    analyticsBtn.style.opacity = '1';
  }
};
