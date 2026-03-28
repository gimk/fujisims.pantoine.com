import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const recipesCollection = defineCollection({
    loader: glob({ pattern: "*.md", base: "./src/content/recipes" }),
    schema: ({ image }) => z.object({
        name: z.string(),
        refNo: z.string(),
        version: z.string(),
        calibration: z.string(),
        status: z.string(),
        opt: z.string(),
        author: z.string(),
        authorLink: z.string().url().optional(),
        submittedAt: z.string().optional(),
        core: z.array(z.object({
            label: z.string(),
            value: z.union([z.string(), z.number()])
        })),
        adjustments: z.array(z.object({
            label: z.string(),
            value: z.union([z.string(), z.number()]),
        })),
        images: z.array(image())
    })
});

export const collections = {
    'recipes': recipesCollection,
};
