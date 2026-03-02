import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
// Connection pooling config for serverless speed
const options = {
    maxPoolSize: 10,
    minPoolSize: 1,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
    throw new Error('Please add your Mongo URI to .env.local');
}

if (process.env.NODE_ENV === 'development') {
    const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
    };
    if (!globalWithMongo._mongoClientPromise) {
        client = new MongoClient(uri!, options);
        globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
} else {
    // In production (Vercel), create a unified client using options
    client = new MongoClient(uri!, options);
    clientPromise = client.connect();
}

export default clientPromise;
