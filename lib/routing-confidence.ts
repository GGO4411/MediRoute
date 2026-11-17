export const MINIMUM_SPECIALTY_SUGGESTION_SCORE=0.35;

export type ScoredSpecialtyMatch={score:number;specialty?:string};

export function hasUsefulSpecialtyMatch(matches:ScoredSpecialtyMatch[]):boolean{
 return matches.some(match=>Number.isFinite(match.score)&&match.score>=MINIMUM_SPECIALTY_SUGGESTION_SCORE&&Boolean(match.specialty?.trim()));
}
