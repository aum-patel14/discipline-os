import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';

// Validation Schemas
const habitCreateSchema = z.object({
  name: z.string().min(1).max(50),
  emoji: z.string().emoji().or(z.string().min(1).max(10)), // flexible for text emojis or emojis
  unit: z.string().min(1).max(20),
  base_goal: z.number().positive(),
  step_size: z.number().positive(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  is_villain: z.boolean().default(false),
});

const habitUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  emoji: z.string().optional(),
  unit: z.string().min(1).max(20).optional(),
  base_goal: z.number().positive().optional(),
  current_goal: z.number().positive().optional(),
  step_size: z.number().positive().optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  is_villain: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

const habitReorderSchema = z.object({
  ids: z.array(z.string().uuid()),
});

export const getHabits = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: habits, error } = await supabaseAdmin
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(habits);
  } catch (error) {
    next(error);
  }
};

export const createHabit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = habitCreateSchema.parse(req.body);

    // Get current max sort_order
    const { data: currentHabits, error: orderError } = await supabaseAdmin
      .from('habits')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (orderError) {
      return res.status(400).json({ error: orderError.message });
    }

    const maxSortOrder = currentHabits.reduce((max, h) => h.sort_order > max ? h.sort_order : max, 0);

    const { data: newHabit, error } = await supabaseAdmin
      .from('habits')
      .insert({
        user_id: userId,
        ...data,
        current_goal: data.base_goal, // initialize current_goal to base_goal
        sort_order: maxSortOrder + 1,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json(newHabit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const updateHabit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const data = habitUpdateSchema.parse(req.body);

    // Verify ownership first
    const { data: habitCheck, error: checkError } = await supabaseAdmin
      .from('habits')
      .select('user_id')
      .eq('id', id)
      .single();

    if (checkError || !habitCheck || habitCheck.user_id !== userId) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const { data: updatedHabit, error } = await supabaseAdmin
      .from('habits')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(updatedHabit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const deleteHabit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify ownership
    const { data: habitCheck, error: checkError } = await supabaseAdmin
      .from('habits')
      .select('user_id')
      .eq('id', id)
      .single();

    if (checkError || !habitCheck || habitCheck.user_id !== userId) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabaseAdmin
      .from('habits')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Habit deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const reorderHabits = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { ids } = habitReorderSchema.parse(req.body);

    // Update sort_order for each ID sequentially in a loop.
    // In a production SQL database, doing bulk updates or using case statements is ideal,
    // but a series of updates works perfectly here.
    for (let index = 0; index < ids.length; index++) {
      const habitId = ids[index];
      await supabaseAdmin
        .from('habits')
        .update({ sort_order: index + 1 })
        .eq('id', habitId)
        .eq('user_id', userId);
    }

    return res.status(200).json({ message: 'Habits reordered successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const resetGoals = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Retrieve active habits
    const { data: activeHabits, error: fetchError } = await supabaseAdmin
      .from('habits')
      .select('id, base_goal')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (fetchError) {
      return res.status(400).json({ error: fetchError.message });
    }

    // Update each habit's current_goal to its base_goal
    for (const habit of activeHabits) {
      await supabaseAdmin
        .from('habits')
        .update({ current_goal: habit.base_goal })
        .eq('id', habit.id);
    }

    return res.status(200).json({ message: 'All habit goals have been reset to their base values.' });
  } catch (error) {
    next(error);
  }
};
