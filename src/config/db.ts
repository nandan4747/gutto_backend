
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || "", {
      dbName: "Gutto", // Your secret is safe here
    });
    console.log(`Database Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1); // Kill the server if the DB is down
  }
};

export default connectDB;
