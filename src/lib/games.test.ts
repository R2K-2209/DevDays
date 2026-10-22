import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterGames(db: Database): Promise<{
    strategyCategoryId: number;
    puzzleCategoryId: number;
    codeForgeId: number;
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'Strategy games' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'Puzzle games' })
        .returning({ id: categories.id });
    const [codeForge] = await db
        .insert(publishers)
        .values({ name: 'CodeForge Studios', description: 'Publisher' })
        .returning({ id: publishers.id });
    const [devMasters] = await db
        .insert(publishers)
        .values({ name: 'DevMasters Inc.', description: 'Publisher' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'DevOps Dominion',
            description: 'A strategy game',
            categoryId: strategy.id,
            publisherId: codeForge.id,
        },
        {
            title: 'Pipeline Conquest',
            description: 'Another strategy game',
            categoryId: strategy.id,
            publisherId: devMasters.id,
        },
        {
            title: 'Code Puzzle Chronicles',
            description: 'A puzzle game',
            categoryId: puzzle.id,
            publisherId: codeForge.id,
        },
        {
            title: 'Merge Conflict Mystery',
            description: 'Another puzzle game',
            categoryId: puzzle.id,
            publisherId: devMasters.id,
        },
    ]);

    return {
        strategyCategoryId: strategy.id,
        puzzleCategoryId: puzzle.id,
        codeForgeId: codeForge.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('matches any selected category and combines categories with publisher', async () => {
        const { strategyCategoryId, puzzleCategoryId, codeForgeId } = await seedFilterGames(db);

        const matchingCategories = await getFilteredGames(db, {
            categoryIds: [strategyCategoryId, puzzleCategoryId],
        });
        expect(matchingCategories.map((game) => game.title)).toEqual([
            'Code Puzzle Chronicles',
            'DevOps Dominion',
            'Merge Conflict Mystery',
            'Pipeline Conquest',
        ]);

        const matchingCategoriesAndPublisher = await getFilteredGames(db, {
            categoryIds: [strategyCategoryId, puzzleCategoryId],
            publisherId: codeForgeId,
        });
        expect(matchingCategoriesAndPublisher.map((game) => game.title)).toEqual([
            'Code Puzzle Chronicles',
            'DevOps Dominion',
        ]);
    });

    it('filters by publisher without category restrictions', async () => {
        const { codeForgeId } = await seedFilterGames(db);

        const matchingGames = await getFilteredGames(db, { publisherId: codeForgeId });

        expect(matchingGames.map((game) => game.title)).toEqual([
            'Code Puzzle Chronicles',
            'DevOps Dominion',
        ]);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
