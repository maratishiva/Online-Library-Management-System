# Online Library Management System

A lab-internal project demonstrating GitHub, Jenkins, Docker and Selenium using Node.js, Express and SQLite.

## Features

- Administrator login
- Add, update, delete and search books
- Student registration
- Issue and return books
- Automatic overdue fine calculation (default ₹5 per day)
- JSON API and browser-based dashboard

## Requirements

- Node.js 20 or later
- npm
- Git
- Docker Desktop (for container build/run)
- Python 3.9 or later (for Selenium tests)
- Google Chrome (for Selenium tests)
- Jenkins (optional for CI pipeline)

## 1. Open in VS Code

Extract the ZIP file, open the `OnlineLibraryManagementSystem` folder in VS Code, then open Terminal > New Terminal.

## 2. Install and run locally

```bash
npm install
npm start
```

Open http://localhost:3000

Demo administrator credentials:
- Username: `admin`
- Password: `admin123`

Change these before any real deployment by setting `ADMIN_USER`, `ADMIN_PASSWORD` and `SESSION_SECRET` environment variables. This demo login is intended only for a local lab.

## 3. Run the Node test command

```bash
npm test
```

The project includes a Node test script command. Add project-specific Node unit tests under `tests` if you want this stage to test more than the test-runner setup.

## 4. Build and run Docker

```bash
docker build -t online-library:latest .
docker run -d --name online-library-container -p 3000:3000 -v library-data:/app/data online-library:latest
```

Open http://localhost:3000

Useful commands:

```bash
docker ps
docker logs online-library-container
docker stop online-library-container
docker rm online-library-container
```

The named Docker volume keeps the SQLite database when the container is replaced.

## 5. Run Selenium tests

Keep the application running locally or in Docker. In a second terminal:

```bash
python -m venv .venv
```

Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m unittest discover -s tests -p "selenium_test.py" -v
```

If PowerShell blocks activation, run:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

The Selenium script uses Chrome. Selenium 4.6+ can usually manage the driver automatically if Chrome and network access are available. Set `HEADLESS=false` to show the browser:
```powershell
$env:HEADLESS="false"
python -m unittest discover -s tests -p "selenium_test.py" -v
```

The test suite is stateful: it adds a test book and student, issues a book and returns an issued loan. Run it against a fresh/demo database for repeatable results. Tests are examples for lab practice; adapt selectors and test data if you change the UI.

## 6. GitHub

Create an empty GitHub repository, then run (replace the URL):

```bash
git init
git add .
git commit -m "Initial Online Library Management System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/OnlineLibraryManagementSystem.git
git push -u origin main
```

## 7. Jenkins

1. Install Jenkins and ensure the Jenkins agent has Git, Node.js 20+, npm and Docker installed.
2. Create a Pipeline job.
3. Under Pipeline, select **Pipeline script from SCM**.
4. Select Git and enter your repository URL.
5. Set branch to `*/main` and script path to `Jenkinsfile`.
6. Save and click **Build Now**.

The Jenkinsfile checks out the source, checks Node/npm, installs dependencies, runs `npm test`, and builds the Docker image. For a private repository, configure Jenkins Git credentials. The agent service account must have permission to access Docker.

## Default demo data and fine

The database is created automatically at `data/library.db`, with two sample books. New students and books can be added from the dashboard. Fine is calculated at return time as:

`overdue days × FINE_PER_DAY`

Default `FINE_PER_DAY` is 5. Set a different amount with an environment variable if needed.

## Important lab notes

- The default credentials are intentionally simple and are not production-safe.
- Use HTTPS, strong password hashing, CSRF protection, secure session cookies, input validation and proper secrets management before any public deployment.
- Do not commit `.env`, database files or real student personal data.
- The Jenkins pipeline runs the Node test command. Selenium tests are run separately after the app is started, because browser tests need a live application and browser.
