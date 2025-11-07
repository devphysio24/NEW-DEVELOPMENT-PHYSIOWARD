-- Debug queries to check rehabilitation plan completions

-- 1. Check all rehabilitation plans for this clinician
SELECT 
    rp.id as plan_id,
    rp.plan_name,
    rp.start_date,
    rp.end_date,
    rp.status,
    we.user_id as worker_user_id,
    u.email as worker_email,
    u.full_name as worker_name
FROM rehabilitation_plans rp
LEFT JOIN worker_exceptions we ON rp.exception_id = we.id
LEFT JOIN users u ON we.user_id = u.id
WHERE rp.clinician_id = (SELECT id FROM users WHERE email = 'sam@example.com' LIMIT 1)
    OR rp.status = 'active'
ORDER BY rp.created_at DESC;

-- 2. Check all completions for a specific plan (replace PLAN_ID with actual plan ID)
-- First, get the plan ID from query above, then:
SELECT 
    rpc.id,
    rpc.plan_id,
    rpc.exercise_id,
    rpc.user_id,
    rpc.completion_date,
    u.email as worker_email,
    u.full_name as worker_name,
    re.exercise_name
FROM rehabilitation_plan_completions rpc
LEFT JOIN users u ON rpc.user_id = u.id
LEFT JOIN rehabilitation_exercises re ON rpc.exercise_id = re.id
WHERE rpc.plan_id = 'PLAN_ID_HERE'  -- Replace with actual plan_id
ORDER BY rpc.completion_date DESC, rpc.created_at DESC;

-- 3. Check if there are ANY completions for active plans
SELECT 
    rp.id as plan_id,
    rp.plan_name,
    COUNT(rpc.id) as total_completions,
    COUNT(DISTINCT rpc.completion_date) as days_with_completions,
    COUNT(DISTINCT rpc.exercise_id) as unique_exercises_completed
FROM rehabilitation_plans rp
LEFT JOIN rehabilitation_plan_completions rpc ON rp.id = rpc.plan_id
WHERE rp.status = 'active'
GROUP BY rp.id, rp.plan_name
ORDER BY rp.created_at DESC;

-- 4. Check completions for today
SELECT 
    rpc.*,
    u.email as worker_email,
    u.full_name as worker_name,
    re.exercise_name,
    rp.plan_name
FROM rehabilitation_plan_completions rpc
LEFT JOIN users u ON rpc.user_id = u.id
LEFT JOIN rehabilitation_exercises re ON rpc.exercise_id = re.id
LEFT JOIN rehabilitation_plans rp ON rpc.plan_id = rp.id
WHERE rpc.completion_date = CURRENT_DATE
ORDER BY rpc.created_at DESC;

-- 5. Check for user_id mismatch between plan worker and completion user
SELECT 
    rp.id as plan_id,
    rp.plan_name,
    we.user_id as expected_worker_id,
    u1.email as expected_worker_email,
    rpc.user_id as completion_user_id,
    u2.email as completion_user_email,
    COUNT(rpc.id) as completion_count
FROM rehabilitation_plans rp
LEFT JOIN worker_exceptions we ON rp.exception_id = we.id
LEFT JOIN users u1 ON we.user_id = u1.id
LEFT JOIN rehabilitation_plan_completions rpc ON rp.id = rpc.plan_id
LEFT JOIN users u2 ON rpc.user_id = u2.id
WHERE rp.status = 'active'
GROUP BY rp.id, rp.plan_name, we.user_id, u1.email, rpc.user_id, u2.email
ORDER BY rp.created_at DESC;

-- 6. Get all exercises for a plan
SELECT 
    re.id as exercise_id,
    re.exercise_name,
    re.exercise_order,
    rp.id as plan_id,
    rp.plan_name
FROM rehabilitation_exercises re
LEFT JOIN rehabilitation_plans rp ON re.plan_id = rp.id
WHERE rp.status = 'active'
ORDER BY rp.id, re.exercise_order;

-- 7. Complete check: Plan, Worker, Exercises, and Completions
SELECT 
    rp.id as plan_id,
    rp.plan_name,
    rp.start_date,
    rp.end_date,
    we.user_id as worker_user_id,
    u.email as worker_email,
    u.full_name as worker_name,
    COUNT(DISTINCT re.id) as total_exercises,
    COUNT(DISTINCT CASE WHEN rpc.completion_date = CURRENT_DATE THEN rpc.exercise_id END) as completed_today,
    COUNT(DISTINCT rpc.completion_date) as days_completed
FROM rehabilitation_plans rp
LEFT JOIN worker_exceptions we ON rp.exception_id = we.id
LEFT JOIN users u ON we.user_id = u.id
LEFT JOIN rehabilitation_exercises re ON rp.id = re.plan_id
LEFT JOIN rehabilitation_plan_completions rpc ON rp.id = rpc.plan_id 
    AND rpc.user_id = we.user_id
    AND rpc.completion_date >= rp.start_date
WHERE rp.status = 'active'
GROUP BY rp.id, rp.plan_name, rp.start_date, rp.end_date, we.user_id, u.email, u.full_name
ORDER BY rp.created_at DESC;

