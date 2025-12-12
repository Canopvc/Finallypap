import 'dotenv/config';

export default {
  expo: {
    name: "Finallypap",
    slug: "Finallypap",
    extra: {
      COHERE_API_KEY: process.env.COHERE_API_KEY,
    },
    android: {
      package: "com.mimero.finallypap" 
    }
  },
};
