// services/workouts.ts
import { supabase } from '../lib/supabase';

export type InsertWorkoutInput = {
  name: string;
  exercises: any[];
  createdAt?: string;
};

export async function insertWorkout(
  workout: InsertWorkoutInput,
  userId?: string
) {
  const payload: any = {
    name: workout.name,
    created_at: workout.createdAt ?? new Date().toISOString(),
    exercises: workout.exercises,
  };
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (userId) {
    if (uuidRegex.test(userId)) {
      payload.user_uuid = userId;
      payload.user_id = null;
    } else if (!Number.isNaN(Number(userId))) {
      payload.user_id = Number(userId);
      payload.user_uuid = null;
    } else {
      payload.user_id = null;
      payload.user_uuid = null;
    }
  } else {
    payload.user_id = null;
    payload.user_uuid = null;
  }
  const { data, error } = await supabase
    .from('workouts')
    .insert([payload]);
  if (error) {
    console.error('[insertWorkout] error:', error);
    throw error;
  }
  return data;
}
