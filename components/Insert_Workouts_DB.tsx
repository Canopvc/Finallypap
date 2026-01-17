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

  // If your DB uses bigint user_id, only send numeric ids.
  // If your DB uses UUIDs (or you added user_uuid), send UUID properly.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (userId) {
    if (uuidRegex.test(userId)) {
      // prefer user_uuid column (add this column in DB) to store auth.user.id
      payload.user_uuid = userId;
    } else if (!Number.isNaN(Number(userId))) {
      payload.user_id = Number(userId);
    } else {
      // fallback: don't send user_id to avoid DB type error
      payload.user_id = null;
    }
  } else {
    payload.user_id = null;
  }

  console.log('[insertWorkout] payload:', payload);

  const { data, error } = await supabase
    .from('workouts')
    .insert([payload]);

   

  if (error) {
    console.error('[insertWorkout] error:', error);
    throw error;
  }

  const {data: dbData, error: dbError} = await supabase.from('ContasRegistradas').insert([{
    created_at: workout.createdAt ?? new Date().toISOString(),

    
  }]);
  return data;
}
