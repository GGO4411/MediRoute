import { z } from 'zod';

const nonBlank=(min:number,max:number)=>z.string().trim().min(min).max(max);

export const vectorCorpusEntrySchema=z.object({
 id:nonBlank(2,100),
 condition:nonBlank(3,180),
 description:nonBlank(10,2500),
 specialty:nonBlank(2,100),
 keywords:z.array(nonBlank(1,60)).max(30).default([])
});

export type VectorCorpusEntry=z.infer<typeof vectorCorpusEntrySchema>;
