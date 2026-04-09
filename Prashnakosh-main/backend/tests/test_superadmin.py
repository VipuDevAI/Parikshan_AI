"""
Super Admin Dashboard API Tests
Tests for Schools, Wings, Exams, and Storage CRUD operations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Super Admin credentials
SUPER_ADMIN_CREDS = {
    "schoolCode": "SUPERADMIN",
    "email": "superadmin@safal.com",
    "password": "SuperAdmin@123"
}


class TestAuth:
    """Authentication tests for Super Admin"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "super_admin", "User is not super_admin"
        return data["token"]
    
    def test_superadmin_login(self):
        """Test super admin login returns correct user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == "superadmin@safal.com"
        assert data["user"]["role"] == "super_admin"
        print(f"SUCCESS: Super admin login - user: {data['user']['name']}")


class TestSchoolsCRUD:
    """Schools CRUD operations tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        }
    
    def test_get_schools_list(self, headers):
        """Test GET /api/superadmin/schools returns list"""
        response = requests.get(f"{BASE_URL}/api/superadmin/schools", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} schools")
    
    def test_create_school(self, headers):
        """Test POST /api/superadmin/schools creates a new school"""
        school_data = {
            "name": "TEST_New Test School",
            "code": "TEST001",
            "address": "123 Test Street",
            "phone": "+91 9876543210",
            "principalName": "Dr. Test Principal",
            "principalEmail": "principal@test.edu",
            "principalPhone": "+91 9876543211"
        }
        response = requests.post(f"{BASE_URL}/api/superadmin/schools", headers=headers, json=school_data)
        assert response.status_code in [200, 201], f"Create failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        assert data["name"] == school_data["name"]
        assert data["code"] == school_data["code"]
        print(f"SUCCESS: Created school with id: {data['id']}")
        return data["id"]
    
    def test_create_and_verify_school(self, headers):
        """Test create school and verify via GET"""
        # Create
        school_data = {
            "name": "TEST_Verify School",
            "code": "TESTV01",
            "address": "456 Verify Street"
        }
        create_response = requests.post(f"{BASE_URL}/api/superadmin/schools", headers=headers, json=school_data)
        assert create_response.status_code in [200, 201]
        created = create_response.json()
        school_id = created["id"]
        
        # Verify via GET list
        get_response = requests.get(f"{BASE_URL}/api/superadmin/schools", headers=headers)
        assert get_response.status_code == 200
        schools = get_response.json()
        found = next((s for s in schools if s["id"] == school_id), None)
        assert found is not None, "Created school not found in list"
        assert found["name"] == school_data["name"]
        print(f"SUCCESS: Created and verified school: {school_id}")
    
    def test_update_school(self, headers):
        """Test PATCH /api/superadmin/schools/:id updates school"""
        # First create a school
        school_data = {
            "name": "TEST_Update School",
            "code": "TESTU01"
        }
        create_response = requests.post(f"{BASE_URL}/api/superadmin/schools", headers=headers, json=school_data)
        assert create_response.status_code in [200, 201]
        school_id = create_response.json()["id"]
        
        # Update
        update_data = {
            "name": "TEST_Updated School Name",
            "address": "New Address"
        }
        update_response = requests.patch(f"{BASE_URL}/api/superadmin/schools/{school_id}", headers=headers, json=update_data)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated = update_response.json()
        assert updated["name"] == update_data["name"]
        print(f"SUCCESS: Updated school: {school_id}")
    
    def test_delete_school(self, headers):
        """Test DELETE /api/superadmin/schools/:id deletes school"""
        # First create a school
        school_data = {
            "name": "TEST_Delete School",
            "code": "TESTD01"
        }
        create_response = requests.post(f"{BASE_URL}/api/superadmin/schools", headers=headers, json=school_data)
        assert create_response.status_code in [200, 201]
        school_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/superadmin/schools/{school_id}", headers=headers)
        assert delete_response.status_code in [200, 204], f"Delete failed: {delete_response.text}"
        print(f"SUCCESS: Deleted school: {school_id}")


class TestWingsCRUD:
    """Wings CRUD operations tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        }
    
    @pytest.fixture(scope="class")
    def test_school_id(self, headers):
        """Create a test school for wing tests"""
        school_data = {
            "name": "TEST_Wing Test School",
            "code": "TESTWING"
        }
        response = requests.post(f"{BASE_URL}/api/superadmin/schools", headers=headers, json=school_data)
        if response.status_code in [200, 201]:
            return response.json()["id"]
        # If school already exists, get from list
        schools = requests.get(f"{BASE_URL}/api/superadmin/schools", headers=headers).json()
        for s in schools:
            if s["code"] == "TESTWING":
                return s["id"]
        pytest.skip("Could not create test school")
    
    def test_get_wings_list(self, headers, test_school_id):
        """Test GET /api/superadmin/wings returns list"""
        response = requests.get(f"{BASE_URL}/api/superadmin/wings?schoolId={test_school_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} wings for school")
    
    def test_create_wing(self, headers, test_school_id):
        """Test POST /api/superadmin/wings creates a new wing"""
        wing_data = {
            "tenantId": test_school_id,
            "name": "primary",
            "displayName": "Primary Wing",
            "grades": ["1", "2", "3", "4", "5"],
            "sortOrder": 1
        }
        response = requests.post(f"{BASE_URL}/api/superadmin/wings", headers=headers, json=wing_data)
        assert response.status_code in [200, 201], f"Create wing failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == wing_data["name"]
        print(f"SUCCESS: Created wing with id: {data['id']}")
        return data["id"]
    
    def test_update_wing(self, headers, test_school_id):
        """Test PATCH /api/superadmin/wings/:id updates wing"""
        # Create wing first
        wing_data = {
            "tenantId": test_school_id,
            "name": "secondary",
            "displayName": "Secondary Wing",
            "grades": ["6", "7", "8"],
            "sortOrder": 2
        }
        create_response = requests.post(f"{BASE_URL}/api/superadmin/wings", headers=headers, json=wing_data)
        assert create_response.status_code in [200, 201]
        wing_id = create_response.json()["id"]
        
        # Update
        update_data = {
            "displayName": "Updated Secondary Wing",
            "grades": ["6", "7", "8", "9"]
        }
        update_response = requests.patch(f"{BASE_URL}/api/superadmin/wings/{wing_id}", headers=headers, json=update_data)
        assert update_response.status_code == 200, f"Update wing failed: {update_response.text}"
        print(f"SUCCESS: Updated wing: {wing_id}")
    
    def test_delete_wing(self, headers, test_school_id):
        """Test DELETE /api/superadmin/wings/:id deletes wing"""
        # Create wing first
        wing_data = {
            "tenantId": test_school_id,
            "name": "delete_test",
            "displayName": "Delete Test Wing",
            "grades": ["10"],
            "sortOrder": 3
        }
        create_response = requests.post(f"{BASE_URL}/api/superadmin/wings", headers=headers, json=wing_data)
        assert create_response.status_code in [200, 201]
        wing_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/superadmin/wings/{wing_id}", headers=headers)
        assert delete_response.status_code in [200, 204], f"Delete wing failed: {delete_response.text}"
        print(f"SUCCESS: Deleted wing: {wing_id}")


class TestExamsCRUD:
    """Exams CRUD operations tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        }
    
    @pytest.fixture(scope="class")
    def test_school_and_wing(self, headers):
        """Create test school and wing for exam tests"""
        # Create school
        school_data = {
            "name": "TEST_Exam Test School",
            "code": "TESTEXAM"
        }
        school_response = requests.post(f"{BASE_URL}/api/superadmin/schools", headers=headers, json=school_data)
        if school_response.status_code in [200, 201]:
            school_id = school_response.json()["id"]
        else:
            schools = requests.get(f"{BASE_URL}/api/superadmin/schools", headers=headers).json()
            school_id = next((s["id"] for s in schools if s["code"] == "TESTEXAM"), None)
            if not school_id:
                pytest.skip("Could not create test school")
        
        # Create wing
        wing_data = {
            "tenantId": school_id,
            "name": "exam_wing",
            "displayName": "Exam Test Wing",
            "grades": ["10", "11", "12"],
            "sortOrder": 1
        }
        wing_response = requests.post(f"{BASE_URL}/api/superadmin/wings", headers=headers, json=wing_data)
        if wing_response.status_code in [200, 201]:
            wing_id = wing_response.json()["id"]
        else:
            wings = requests.get(f"{BASE_URL}/api/superadmin/wings?schoolId={school_id}", headers=headers).json()
            wing_id = wings[0]["id"] if wings else None
            if not wing_id:
                pytest.skip("Could not create test wing")
        
        return {"school_id": school_id, "wing_id": wing_id}
    
    def test_get_exams_list(self, headers, test_school_and_wing):
        """Test GET /api/superadmin/exams returns list"""
        school_id = test_school_and_wing["school_id"]
        wing_id = test_school_and_wing["wing_id"]
        response = requests.get(f"{BASE_URL}/api/superadmin/exams?schoolId={school_id}&wingId={wing_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} exams")
    
    def test_create_exam(self, headers, test_school_and_wing):
        """Test POST /api/superadmin/exams creates a new exam"""
        school_id = test_school_and_wing["school_id"]
        wing_id = test_school_and_wing["wing_id"]
        
        exam_data = {
            "tenantId": school_id,
            "wingId": wing_id,
            "examName": "TEST_Mid Term Exam",
            "academicYear": "2025-26",
            "totalMarks": 100,
            "durationMinutes": 180,
            "subjects": ["Mathematics", "Science", "English"],
            "questionPaperSets": 2,
            "pageSize": "A4"
        }
        response = requests.post(f"{BASE_URL}/api/superadmin/exams", headers=headers, json=exam_data)
        assert response.status_code in [200, 201], f"Create exam failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["examName"] == exam_data["examName"]
        print(f"SUCCESS: Created exam with id: {data['id']}")
    
    def test_update_exam(self, headers, test_school_and_wing):
        """Test PATCH /api/superadmin/exams/:id updates exam"""
        school_id = test_school_and_wing["school_id"]
        wing_id = test_school_and_wing["wing_id"]
        
        # Create exam first
        exam_data = {
            "tenantId": school_id,
            "wingId": wing_id,
            "examName": "TEST_Update Exam",
            "academicYear": "2025-26",
            "totalMarks": 50,
            "durationMinutes": 90
        }
        create_response = requests.post(f"{BASE_URL}/api/superadmin/exams", headers=headers, json=exam_data)
        assert create_response.status_code in [200, 201]
        exam_id = create_response.json()["id"]
        
        # Update
        update_data = {
            "examName": "TEST_Updated Exam Name",
            "totalMarks": 75
        }
        update_response = requests.patch(f"{BASE_URL}/api/superadmin/exams/{exam_id}", headers=headers, json=update_data)
        assert update_response.status_code == 200, f"Update exam failed: {update_response.text}"
        print(f"SUCCESS: Updated exam: {exam_id}")
    
    def test_delete_exam(self, headers, test_school_and_wing):
        """Test DELETE /api/superadmin/exams/:id deletes exam"""
        school_id = test_school_and_wing["school_id"]
        wing_id = test_school_and_wing["wing_id"]
        
        # Create exam first
        exam_data = {
            "tenantId": school_id,
            "wingId": wing_id,
            "examName": "TEST_Delete Exam",
            "academicYear": "2025-26",
            "totalMarks": 25,
            "durationMinutes": 45
        }
        create_response = requests.post(f"{BASE_URL}/api/superadmin/exams", headers=headers, json=exam_data)
        assert create_response.status_code in [200, 201]
        exam_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/superadmin/exams/{exam_id}", headers=headers)
        assert delete_response.status_code in [200, 204], f"Delete exam failed: {delete_response.text}"
        print(f"SUCCESS: Deleted exam: {exam_id}")


class TestStorageConfig:
    """S3 Storage configuration tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        }
    
    def test_get_all_storage_configs(self, headers):
        """Test GET /api/superadmin/storage/all returns storage configs"""
        response = requests.get(f"{BASE_URL}/api/superadmin/storage/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} storage configs")
    
    def test_save_storage_config(self, headers):
        """Test POST /api/superadmin/storage saves storage config"""
        # First get a school
        schools_response = requests.get(f"{BASE_URL}/api/superadmin/schools", headers=headers)
        assert schools_response.status_code == 200
        schools = schools_response.json()
        
        if not schools:
            # Create a school first
            school_data = {
                "name": "TEST_Storage School",
                "code": "TESTSTORE"
            }
            create_response = requests.post(f"{BASE_URL}/api/superadmin/schools", headers=headers, json=school_data)
            assert create_response.status_code in [200, 201]
            school_id = create_response.json()["id"]
        else:
            school_id = schools[0]["id"]
        
        # Save storage config
        storage_data = {
            "tenantId": school_id,
            "s3BucketName": "test-bucket",
            "s3FolderPath": f"schools/{school_id}",
            "maxStorageBytes": 10737418240  # 10GB
        }
        response = requests.post(f"{BASE_URL}/api/superadmin/storage", headers=headers, json=storage_data)
        assert response.status_code in [200, 201], f"Save storage config failed: {response.text}"
        print(f"SUCCESS: Saved storage config for school: {school_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
