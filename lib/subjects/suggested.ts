// Common subjects for each school level, from the NaCCA curriculum (Ghana).
// Shown as one-click buttons on the Students page. Nothing is added until the owner clicks.
import type { ClassLevel } from '@/lib/validation/classes';

export const suggestedSubjects: Record<ClassLevel, string[]> = {
  pre_school: ['Language and Literacy', 'Numeracy', 'Creative Arts', 'Our World and Our People'],
  primary: [
    'English Language',
    'Mathematics',
    'Science',
    'Ghanaian Language',
    'Computing',
    'Creative Arts',
    'French',
    'Our World and Our People',
    'Religious and Moral Education',
    'Physical Education',
  ],
  jhs: [
    'English Language',
    'Mathematics',
    'Integrated Science',
    'Social Studies',
    'Ghanaian Language',
    'French',
    'Computing',
    'Career Technology',
    'Creative Arts and Design',
    'Religious and Moral Education',
    'Physical Education and Health',
  ],
};

export const allSuggestedSubjects = Array.from(new Set(Object.values(suggestedSubjects).flat()));

export function isSuggestedSubject(name: string): boolean {
  return allSuggestedSubjects.includes(name);
}
