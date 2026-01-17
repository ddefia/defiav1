
import { DEFAULT_PROFILES } from '../services/brandData';

const profile = DEFAULT_PROFILES['Metis'];
console.log('Metis Tweet Examples:', profile.tweetExamples.length);
console.log('First Example:', profile.tweetExamples[0].substring(0, 50) + '...');
console.log('Metis KB Entries:', profile.knowledgeBase.length);
console.log('Last KB Entry:', profile.knowledgeBase[profile.knowledgeBase.length - 1]);
