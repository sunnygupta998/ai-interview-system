import os
from pymongo import MongoClient
import config

def cleanup_db():
    print("Connecting to database...")
    client = MongoClient(config.MONGODB_URI)
    db = client[config.DB_NAME]
    
    # Since the users were already deleted before the crash, we now need to delete 
    # any records that don't belong to the remaining users (admins).
    remaining_users = list(db.users.find({}))
    remaining_user_ids = [u['_id'] for u in remaining_users]
    
    print(f"Found {len(remaining_user_ids)} admin/remaining users. Cleaning up orphaned data...")
    
    # Delete associated Resumes
    res_resumes = db.resumes.delete_many({'user_id': {'$nin': remaining_user_ids}})
    print(f"Deleted {res_resumes.deleted_count} orphaned resumes.")
    
    # Delete associated Tests
    res_tests = db.tests.delete_many({'user_id': {'$nin': remaining_user_ids}})
    print(f"Deleted {res_tests.deleted_count} orphaned tests.")
    
    # Delete associated Results
    res_results = db.results.delete_many({'user_id': {'$nin': remaining_user_ids}})
    print(f"Deleted {res_results.deleted_count} orphaned results.")
    
    # Delete associated Interviews
    res_interviews = db.interviews.delete_many({'user_id': {'$nin': remaining_user_ids}})
    print(f"Deleted {res_interviews.deleted_count} orphaned interviews.")
    
    print("\nDatabase cleanup complete. All orphaned candidate data has been wiped!")

if __name__ == '__main__':
    # Confirm before running
    confirm = input("Are you sure you want to delete all candidates and their data? (yes/no): ")
    if confirm.lower() == 'yes':
        cleanup_db()
    else:
        print("Cleanup cancelled.")