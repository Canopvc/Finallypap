import { supabase } from '../lib/supabase';

export async function insertWorkout(workout: {
  name: string;
  createdAt?: string;
  created_at?: string;
  exercises: any[];
}, userId?: string) {
  const created_at = workout.created_at ?? workout.createdAt ?? new Date().toISOString();

  const payload = {
    user_id: userId ?? null,
    name: workout.name,
    created_at,
    exercises: workout.exercises,
  };

  const { data, error } = await supabase.from('workouts').insert([payload]);
  if (error) throw error;
  return data;
}
```// filepath: c:\pap\Finallypap\components\Insert_Workouts_DB.tsx
import { supabase } from '../lib/supabase';

export async function insertWorkout(workout: {
  name: string;
  createdAt?: string;
  created_at?: string;
  exercises: any[];
}, userId?: string) {
  const created_at = workout.created_at ?? workout.createdAt ?? new Date().toISOString();

  const payload = {
    user_id: userId ?? null,
    name: workout.name,
    created_at,
    exercises: workout.exercises,
  };

  const { data, error } = await supabase.from('workouts').insert([payload]);
  if (error) throw error;
  return data;
}