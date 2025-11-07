-- Quick check: See all completions for active plans
-- Run this first to see if completions are being saved

SELECT 
    rpc.id,
    rpc.plan_id,
    rpc.exercise_id,
    rpc.user_id as completion_user_id,
    u.email as completion_user_email,
    u.full_name as completion_user_name,
    rpc.completion_date,
    rpc.created_at,
    rp.plan_name,
    re.exercise_name,
    -- Get expected worker from the plan
    we.user_id as expected_worker_id,
    u2.email as expected_worker_email,
    u2.full_name as expected_worker_name,
    -- Check if user_id matches
    CASE 
        WHEN rpc.user_id = we.user_id THEN 'MATCH' 
        ELSE 'MISMATCH' 
    END as user_match_status
FROM rehabilitation_plan_completions rpc
LEFT JOIN rehabilitation_plans rp ON rpc.plan_id = rp.id
LEFT JOIN rehabilitation_exercises re ON rpc.exercise_id = re.id
LEFT JOIN users u ON rpc.user_id = u.id
LEFT JOIN worker_exceptions we ON rp.exception_id = we.id
LEFT JOIN users u2 ON we.user_id = u2.id
WHERE rp.status = 'active'
ORDER BY rpc.created_at DESC;

-- Check if jonathan@gmail.com has any completions
SELECT 
    rpc.*,
    u.email,
    u.full_name,
    rp.plan_name,
    re.exercise_name
FROM rehabilitation_plan_completions rpc
LEFT JOIN users u ON rpc.user_id = u.id
LEFT JOIN rehabilitation_plans rp ON rpc.plan_id = rp.id
LEFT JOIN rehabilitation_exercises re ON rpc.exercise_id = re.id
WHERE u.email = 'jonathan@gmail.com'
ORDER BY rpc.created_at DESC;

