
// Fix: Implemented the Gemini API service for image analysis.
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResultData, Language } from '../types';
import { MODEL_NAME, IMAGE_MODEL_NAME, LANGUAGES } from '../constants';
import { ALL_VETERINARY_CONTACTS } from '../data/veterinaryData';


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    animal: { type: Type.STRING, description: 'Type of animal (e.g., dog, cat, bird).' },
    isInjured: { type: Type.BOOLEAN, description: 'Whether the animal appears to be injured.' },
    injurySeverity: { type: Type.STRING, description: "Severity of injury. Must be one of: 'low', 'medium', 'high', or 'unknown'. Avoid exaggeration. Reserve 'high' or 'critical' for life-threatening situations only." },
    probableCondition: { type: Type.STRING, description: 'The most likely condition based on visual evidence (e.g., "Maggot wound", "Leg fracture from accident", "Mange/skin infection", "Malnutrition"). Be specific but cautious.' },
    recommendedMedicines: {
      type: Type.OBJECT,
      properties: {
        tablets: {
          type: Type.ARRAY,
          items: {
             type: Type.OBJECT,
             properties: {
                name: { type: Type.STRING, description: "Name of the tablet (generic or common brand available in India like Melonex, Cephalexin)." },
                usageInstruction: { type: Type.STRING, description: "Detailed, creative, and practical instruction. Mention food pairings (e.g., 'crush and mix with curd rice', 'hide in jaggery/sweet bun'), safety tips, and dosage approximation for the size of the animal." }
             },
             required: ['name', 'usageInstruction']
          },
          description: "List of standard tablets with detailed, creative administration tips."
        },
        ointments: {
          type: Type.ARRAY,
          items: {
             type: Type.OBJECT,
             properties: {
                name: { type: Type.STRING, description: "Name of the ointment/spray (e.g., Himax, Topicure, D-Mag, Betadine)." },
                usageInstruction: { type: Type.STRING, description: "Practical instruction on application. Suggest tools if aggressive (e.g., 'spray from distance', 'apply using a long stick with cotton')." }
             },
             required: ['name', 'usageInstruction']
          },
          description: "List of topicals with specific application tips."
        }
      },
      required: ['tablets', 'ointments'],
      description: "Suggested medicines with administration guides."
    },
    firstAidSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'A list of immediate, safe first aid steps a layperson can perform. Start with a safety warning if applicable (e.g., "Warning: Approach with caution...").',
    },
    nextSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'A list of next steps, like contacting a vet or animal rescue.',
    },
    disclaimer: { type: Type.STRING, description: 'A mandatory disclaimer that this is not a substitute for professional veterinary advice.' },
    localSupport: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          address: { type: Type.STRING },
          phone: { type: Type.STRING },
          mapsLink: { type: Type.STRING },
        },
        required: ['name', 'address', 'phone', 'mapsLink'],
      },
      description: 'A list of 2-3 of the most relevant and nearest veterinary services based on the user location. Select from the provided knowledge base.',
    }
  },
  required: ['animal', 'isInjured', 'injurySeverity', 'probableCondition', 'recommendedMedicines', 'firstAidSteps', 'nextSteps', 'disclaimer', 'localSupport'],
};

const getPrompt = (
    language: Language, 
    description: string, 
    location: { lat: number; lon: number } | string | null
) => {
    const langLabel = LANGUAGES.find(l => l.value === language)?.label || 'English';
    let locationInfo = 'User location is not available.';
    if (location) {
        if (typeof location === 'string') {
            locationInfo = `The user's manually entered location is "${location}".`;
        } else if (typeof location === 'object' && location.lat && location.lon) {
            locationInfo = `The user is at approximately latitude ${location.lat} and longitude ${location.lon}.`;
        }
    }
    const userDescription = description ? `User adds this context: "${description}"` : '';

    return `You are Karuṇā, a compassionate AI veterinary assistant. Your goal is to identify the most probable condition and provide simple first-aid.
    
    Analyze the image for common signs of distress. Specifically look for:
    - Wounds: Check for infection or maggots.
    - Accidents: Look for broken limbs or visible trauma.
    - Skin Issues: Identify hair loss, rashes, or scabs (suggesting mange or infection).
    - Malnutrition: Note if the animal is emaciated.

    Based on this, populate the 'probableCondition' field with your most specific finding.

    CRITICAL - MEDICAL PRESCRIPTIONS (India Specific):
    Populate 'recommendedMedicines' with standard veterinary treatments easily available in India.
    - Tablets: Suggest basics like Meloxicam (Melonex) for pain, Cephalexin/Amoxycillin for infection, Ivermectin (Neomec) for mange/ticks if appropriate.
    - Ointments/Sprays: Suggest Himax, Topicure, D-Mag, Lorexane, or Betadine.

    **USAGE INSTRUCTIONS (Be Rich & Creative)**:
    For each medicine, the 'usageInstruction' MUST be spontaneous and practical for a street situation:
    - **Food Hiding**: "Hide the tablet in a piece of sweet bun, gulab jamun, or mix with curd rice/pedigree."
    - **Aggressive Animals**: "Do not touch. Grind the tablet into powder and mix with strong-smelling food like wet chicken." or "Use a spray from a safe distance."
    - **Wound Care**: "Clean with saline or turmeric water. If using tube ointment, apply on a long stick and gently touch the wound."

    Your response must be in ${langLabel}.
    ${userDescription}
    ${locationInfo}

    Based on the user's location, you MUST select the 2-3 nearest and most relevant support centers from the knowledge base below and include them in the 'localSupport' field.
    Provide calm, clear, simple first-aid instructions. Do not cause alarm.
    Structure your response in JSON according to the schema. Output only the JSON.

    KNOWLEDGE BASE of VETERINARY AND NGO CONTACTS:
    ${JSON.stringify(ALL_VETERINARY_CONTACTS)}
    `;
}


export const analyzeImage = async (
  imageDataUrl: string,
  description: string,
  language: Language,
  location: { lat: number; lon: number } | string | null,
): Promise<AnalysisResultData> => {
  try {
    const imagePart = {
      inlineData: {
        data: imageDataUrl.split(',')[1],
        mimeType: imageDataUrl.split(',')[0].split(':')[1].split(';')[0],
      },
    };

    const textPart = {
      text: getPrompt(language, description, location),
    };

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts: [imagePart, textPart] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
        }
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    return result as AnalysisResultData;

  } catch (error) {
    console.error('Error analyzing image:', error);
    throw new Error('Failed to analyze the image. The model may be unable to process this request. Please try a different image or try again later.');
  }
};

export const generateFirstAidVisual = async (step: string, animal: string): Promise<string> => {
  try {
    const prompt = `Create a simple, clear, medical-style illustration showing how to perform this first aid step on a ${animal}: "${step}". 
    The image should be educational, clean, and on a plain background. Do not generate gore. Focus on the action (e.g., bandaging, holding).`;

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME, // gemini-2.5-flash-image
      contents: {
        parts: [{ text: prompt }],
      },
    });

    // Iterate through all parts to find the image part
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image generated by the model.");
  } catch (error) {
    console.error('Error generating visual:', error);
    throw new Error('Could not generate visual aid.');
  }
};