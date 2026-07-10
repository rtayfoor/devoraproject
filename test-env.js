const dotenv = require('dotenv'); 
const path = require('path'); 
const result = dotenv.config({ path: path.join(__dirname, ".env") }); 
console.log("SUPABASE_URL:", process.env.SUPABASE_URL); 
console.log("DB_HOST:", process.env.DB_HOST); 
