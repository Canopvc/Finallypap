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
      // Usar user_uuid para UUIDs (auth.users.id é sempre UUID)
      payload.user_uuid = userId;
      // Também tentar user_id caso a coluna exista
      payload.user_id = null;
    } else if (!Number.isNaN(Number(userId))) {
      // Se for número, usar user_id
      payload.user_id = Number(userId);
      payload.user_uuid = null;
    } else {
      // fallback: não enviar para evitar erro
      payload.user_id = null;
      payload.user_uuid = null;
    }
  } else {
    payload.user_id = null;
    payload.user_uuid = null;
  }

  console.log('[insertWorkout] payload:', payload);

  const { data, error } = await supabase
    .from('workouts')
    .insert([payload]);
    

   

  if (error) {
    console.error('[insertWorkout] error:', error);
    throw error;
  }


  return data;
}
