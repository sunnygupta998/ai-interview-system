# AI Interview Question System 🤖💼

A full-stack, AI-powered recruitment assessment platform. Candidates upload their resumes in PDF format, the system scans the text to extract technical skills and domain experience using the **Groq Llama 3.3 70B** model, generates custom technical Multiple-Choice Questions (MCQs) aligned with their expertise, and auto-grades results upon submission.

## Features
- **AI Resume Parser:** Scans PDFs and extracts technical competencies, total experience, domain field, and topic recommendations.
- **Custom MCQ Engine:** Dynamically generates custom technical test sets based on candidate's skills.
- **Auto-Grading and Breakdown:** Instant grade evaluations, pass/fail status, and topic breakdowns.
- **Recruiter Controls (Admin):** Admins can adjust the question count, test durations, grade thresholds, and difficulty mixes (Easy/Medium/Hard).
- **Candidate Dashboard:** Tracks resume history, assessment scores, and test statuses.

---

## 🔑 Groq API Key Setup

To use the AI-powered resume analysis and question generation, you need a **free API key** from Groq:

1. Visit the **Groq Console** at [https://console.groq.com](https://console.groq.com).
2. Sign up or log in using your Google account, GitHub, or email.
3. Once logged in, navigate to **API Keys** in the sidebar.
4. Click **Create API Key**, name it (e.g., `AI-Interview-System`), and copy the key starting with `gsk_...`.
5. Open the `backend/.env` file and paste your key in the `GROQ_API_KEY` field.

---

## 🛠️ Prerequisites
Before running the system, make sure you have:
1. **Node.js** (v18 or higher) — for the frontend.
2. **Python** (v3.9 or higher) — for the backend.
3. **MongoDB Server** (Community Edition) & **MongoDB Compass** — for local data storage.

---

## 🚀 Running the System

### 1. Database (MongoDB)
1. Ensure your local MongoDB service is running. If you have MongoDB installed, it usually runs automatically on `mongodb://localhost:27017`.
2. You can open **MongoDB Compass** to connect and verify the connection. The system will automatically create the database `ai_interview_system` when it boots up.

---

### 2. Backend Setup (Flask)
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables. The `.env` file should have the following configurations (make sure to paste your Groq API key here):
   ```ini
   GROQ_API_KEY=gsk_your_actual_groq_key_here
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=ai_interview_system
   JWT_SECRET=your_jwt_secret_key_here_change_this
   FLASK_PORT=5000
   ```
5. Start the backend server:
   ```bash
   python app.py
   ```
   The API server will run on `http://localhost:5000`.

---

### 3. Frontend Setup (React)
1. Open another terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   The web application will open on `http://localhost:3000` (or the terminal specified URL).

---

## 💡 Quick Start Guide
1. **Register Admin:** Go to the register page and click "Admin" to register an administrative recruiter account.
2. **Configure Settings:** Log in as admin, go to **Settings**, adjust the questions count (e.g., 10), pass mark, and difficulty percentage mix. Click **Save Settings**.
3. **Register Candidate:** Log out, then go to register page and select "Candidate" to create a new candidate account.
4. **Upload Resume:** Go to **Upload Resume**, select a PDF resume, and click **Upload & Analyze Resume**.
5. **Take Assessment:** Once the AI skills list appears, click **Generate Assessment**, read the guidelines, click **Start Assessment**, select the options, and click **Submit**.
6. **Check Results:** You will instantly see your marks, pass status, and topic breakdown. If you log back into the **Admin** account, you can see all candidate reports in the admin dashboard.


# 1. Navigate to the backend folder
cd "d:\Apps\Sunny\Sunny\AI Interview System\backend"

# 2. Activate the virtual environment
venv\Scripts\activate

# 3. Start the Flask server
python app.py
Key to registor as admin
supersecretadmin 