import { ConsolidatedAgent } from './definitions/ConsolidatedAgent';
import { AssessmentData, AssessmentStatus } from '../types';

// Instantiate the Omni-Agent
const consolidatedAgent = new ConsolidatedAgent();

export type StatusCallback = (status: AssessmentStatus) => void;

export async function runAgenticPipeline(
    imageB64: string,
    onStatusUpdate: StatusCallback,
    language: string = 'en'
): Promise<AssessmentData> {

    // Start with perception (UI effect)
    onStatusUpdate(AssessmentStatus.PERCEIVING);

    try {
        // ONE API CALL to rule them all
        // While waiting, we can artificially cycle states if we wanted, 
        // but for now we just wait.
        const result = await consolidatedAgent.run(imageB64, language);

        // Rapidly progress through states for the visual flair on the frontend
        // (The user expects to see these stages). increased delays to 1.5s for "show" effect.
        onStatusUpdate(AssessmentStatus.EVALUATING);
        await new Promise(r => setTimeout(r, 1200));

        onStatusUpdate(AssessmentStatus.DEBATING);
        await new Promise(r => setTimeout(r, 1500)); // Give slightly more time for "Debate" weight

        onStatusUpdate(AssessmentStatus.ARBITRATING);
        await new Promise(r => setTimeout(r, 1200));

        onStatusUpdate(AssessmentStatus.EXPLAINING);
        await new Promise(r => setTimeout(r, 1200));

        onStatusUpdate(AssessmentStatus.COMPLETED);

        return result;

    } catch (error) {
        console.error("Pipeline Error:", error);
        onStatusUpdate(AssessmentStatus.ERROR);
        throw error;
    }
}

