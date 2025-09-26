# Trail Logger API

The backend for the trail logger application, built with Node.js, Express, and MongoDB.

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT (Authentication)
- dotenv (Environment management)
- CORS enabled  

## Getting Started  

### 1. Clone the repo  

git clone https://github.com/bomjuk94/Trail-Logger-API   

### 2. Install Dependencies  

cd Trail-Logger-API-main  
npm install  

### 3. Setup environment variables  

PORT=5000  
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/database-name  
JWT_SECRET=your_jwt_secret   

### 4. Start the Server  

npm run start or dev  

### API Endpoints  

#### Auth  

POST /api/register  

POST /api/login  

#### Profile  

GET /api/profile  

PUT /api/profile/save   

#### Trails  

GET /api/trails  

PUT /trails/:id

#### Weather  

GET /proxy/icon/:file  