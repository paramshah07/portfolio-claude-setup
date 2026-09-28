// Typed mirror of content.md. When the two disagree, content.md wins.
// Only structural fields are required: a missing descriptive field renders nothing.
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CARD } from './lib/deck';

const card = z.string().regex(CARD, 'Cards are a rank and a suit, like "As", "Td" or "7h".');
const link = z.string().regex(/^(https:\/\/|mailto:)/, 'Links must start with https:// or mailto:.');
const suit = z.enum(['spades', 'hearts', 'diamonds', 'clubs'], {
  error: 'Suits must be spades, hearts, diamonds or clubs.',
});
const text = z.string().optional();

const profile = defineCollection({
  // One entry, "main", so the JSON file stays a plain object.
  loader: file('src/content/profile.json', { parser: (json) => ({ main: JSON.parse(json) }) }),
  schema: z.object({
    site: z.object({
      name: z.string(),
      tagline: text,
      title: text,
      description: text,
      email: z.email().optional(),
      github: link.optional(),
      linkedin: link.optional(),
      resumePath: text,
      url: z.string().regex(/^https:\/\//, 'The site URL must start with https://.').optional(),
    }),
    player: z.object({
      blurb: text,
      stats: z.array(z.object({ label: z.string(), value: z.string(), note: text })).max(4).default([]),
    }),
    hand: z.object({ hole: z.tuple([card, card]) }),
    suits: z.record(suit, z.string()).optional(),
    experience: z
      .array(
        z.object({
          company: text,
          role: text,
          start: text,
          end: text,
          location: text,
          result: text,
          details: z.array(z.string()).max(3).default([]),
          tags: z.array(z.string()).default([]),
          suit: suit.optional(),
        }),
      )
      .default([]),
    table: z.object({
      org: text,
      role: text,
      dates: text,
      summary: text,
      teams: z.array(z.object({ name: z.string(), members: z.number().int().positive() })).default([]),
    }),
    showdown: text,
  }),
});

const board = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content/board' }),
  schema: z.object({
    street: z.enum(['flop', 'turn', 'river'], { error: 'Streets must be flop, turn or river.' }),
    card,
    name: z.string(),
    pitch: text,
    metric: text,
    stack: z.array(z.string()).default([]),
    links: z.array(z.object({ label: z.string(), href: link })).default([]),
  }),
});

export const collections = { profile, board };
