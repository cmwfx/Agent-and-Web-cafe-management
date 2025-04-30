-- SQL function to mark a lock code as used
-- Copy this function into your Supabase SQL Editor and run it to create the RPC endpoint

-- Create a function that updates the 'used' flag for a given code ID
CREATE OR REPLACE FUNCTION mark_code_as_used(code_id uuid)
RETURNS boolean AS $$
DECLARE
  success boolean;
BEGIN
  UPDATE lock_codes 
  SET used = true 
  WHERE id = code_id;
  
  -- Check if the update was successful
  IF FOUND THEN
    success := true;
  ELSE
    success := false;
  END IF;
  
  RETURN success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the anon role to call this function
GRANT EXECUTE ON FUNCTION mark_code_as_used(uuid) TO anon;

-- Usage instructions: 
-- 1. Copy this entire file to Supabase SQL Editor
-- 2. Run the SQL to create the function
-- 3. Test by calling: SELECT mark_code_as_used('your-code-id-here');
-- 4. The app will now be able to call this function through the RPC API endpoint 