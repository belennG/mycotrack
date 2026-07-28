# MycoTrack

 MycoTrack is a full-stack platform designed for environmental monitoring and sustainable crop management. It enables growers to record and visualise environmental variables (temperature, humidity) across different crop plots.

## 🏗️ Project Structure

The repository is divided into two main services:

- `/backend`: RESTful API built with Python, FastAPI and PostgreSQL.
- `/frontend`: User interface built with React, Vite and Tailwind CSS.

## 🚀 Setup Instructions

*(Detailed installation instructions will be added as the backend and frontend modules are developed).*

### Prerequisites
- Python 3.9+
- Node.js 18+
- Docker & Docker Compose

### Backend Setup & Running Locally

1. **Navigate to the backend folder:**
   ```bash
   cd backend
2. **Create and activate the virtual environment:**
•	Mac/Linux:  

    ```bash
    python -m venv venv 
    source venv/bin/activate

•	Windows:

    ```bash
    python -m venv venv 
    venv\Scripts\activate

3. **Install dependencies:**
    ```bash
    pip install -r requirements.txt
4.  **Run the development server:**
    ```bash
    uvicorn main:app --reload
5. **Verification:**
    Open http://127.0.0.1:8000/health in your browser to verify the backend is running.

