# Fixing the "used" Column Update Issue

This guide provides multiple approaches to fix the issue where the `used` column is not being updated in the Supabase `lock_codes` table.

## Issue Description

- The app successfully unlocks when a valid code is entered
- The app correctly identifies valid codes and allows access
- However, the `used` column remains `FALSE` in the database, even after use

## Solution 1: Add an RPC Function (Recommended)

1. **Log into your Supabase Dashboard**
2. Go to the **SQL Editor** section
3. **Create a new query**
4. Copy the entire content from the `createRpcFunction.sql` file into the SQL editor
5. **Run the query** to create the RPC function
6. The function will automatically be available as an endpoint at:
   `https://cecxwuddkezuvjfqriwm.supabase.co/rest/v1/rpc/mark_code_as_used`

This creates a server-side function with elevated permissions to update the record.

## Solution 2: Check Row Level Security (RLS) Policies

If Solution 1 doesn't work, the issue might be related to RLS policies:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Policies**
3. Look for the policy for the `lock_codes` table
4. Ensure that the policy allows **UPDATE** operations for the `used` column
5. If no update policy exists, add one with:
   ```sql
   (auth.uid() IS NOT NULL) OR (true)
   ```

## Solution 3: Check Foreign Key Constraints

Ensure there are no foreign key constraints preventing updates:

1. Go to the **Table Editor** for the `lock_codes` table
2. Check the table definition for any constraints
3. Temporarily disable any constraints that might be blocking updates

## Solution 4: Test with Different Methods

The app now includes multiple methods to update the record:

- RPC function call
- Direct PATCH request
- Full PUT request
- POST with conflict resolution

Check the debug panel to see which methods are succeeding or failing.

## Solution 5: Try Direct SQL Update

As a last resort, you can manually update records:

```sql
UPDATE lock_codes
SET used = true
WHERE code = 'YOUR_CODE_HERE';
```

## Contact Support

If none of these solutions work, please contact Supabase support with:

1. The detailed error messages from the debug panel
2. Your table structure and RLS policies
3. The exact API calls that are failing
