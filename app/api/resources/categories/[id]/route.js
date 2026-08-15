import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureResourceTables } from '@/lib/resourcesDb';

// Recursive function to collect all subcategory IDs
async function getAllSubcategoryIds(categoryId) {
    const ids = [categoryId];
    const [children] = await pool.execute(
        'SELECT id FROM resource_categories WHERE parent_id = ?',
        [categoryId]
    );

    for (const child of children) {
        const childIds = await getAllSubcategoryIds(child.id);
        ids.push(...childIds);
    }
    return ids;
}

export async function PUT(req, { params }) {
    try {
        await ensureResourceTables();
        const { id } = await params;
        const body = await req.json();
        const { name, parent_id, description, icon, color } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }

        const categoryId = parseInt(id, 10);
        let parentIdValue = parent_id !== undefined ? (parent_id ? parseInt(parent_id, 10) : null) : null;

        // Prevent setting self or descendant as parent
        if (parentIdValue !== null) {
            if (parentIdValue === categoryId) {
                return NextResponse.json({ error: 'A folder cannot be its own parent' }, { status: 400 });
            }
            const descendantIds = await getAllSubcategoryIds(categoryId);
            if (descendantIds.includes(parentIdValue)) {
                return NextResponse.json({ error: 'Cannot set a child folder as parent (circular reference)' }, { status: 400 });
            }
        }

        await pool.execute(
            `UPDATE resource_categories 
             SET name = ?, parent_id = ?, description = ?, icon = ?, color = ? 
             WHERE id = ?`,
            [
                name.trim(),
                parentIdValue,
                description !== undefined ? description : null,
                icon || 'folder',
                color || 'blue',
                categoryId
            ]
        );

        const [updated] = await pool.execute(
            'SELECT * FROM resource_categories WHERE id = ?',
            [categoryId]
        );

        return NextResponse.json({ category: updated[0] });
    } catch (error) {
        console.error('Failed to update category:', error);
        return NextResponse.json({ error: 'Failed to update category: ' + error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        await ensureResourceTables();
        const { id } = await params;
        const categoryId = parseInt(id, 10);

        // Find category and all subcategory IDs recursively
        const allCategoryIds = await getAllSubcategoryIds(categoryId);

        if (allCategoryIds.length > 0) {
            const placeholders = allCategoryIds.map(() => '?').join(',');

            // Delete all links in these categories
            await pool.execute(
                `DELETE FROM resource_links WHERE category_id IN (${placeholders})`,
                allCategoryIds
            );

            // Delete all categories in the list
            await pool.execute(
                `DELETE FROM resource_categories WHERE id IN (${placeholders})`,
                allCategoryIds
            );
        }

        return NextResponse.json({ success: true, deletedIds: allCategoryIds });
    } catch (error) {
        console.error('Failed to delete category:', error);
        return NextResponse.json({ error: 'Failed to delete category: ' + error.message }, { status: 500 });
    }
}
