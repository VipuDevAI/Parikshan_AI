"""
Test Suite for Principal Dashboard and Reference Materials APIs
Tests:
1. Principal Dashboard - Real data from PostgreSQL (no mock/demo data)
2. Super Admin Reference Materials CRUD
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_CREDS = {
    "schoolCode": "SUPERADMIN",
    "email": "superadmin@safal.com",
    "password": "SuperAdmin@123"
}

PRINCIPAL_CREDS = {
    "schoolCode": "TESTSCHOOL",
    "email": "principal@testschool.com",
    "password": "Principal@123"
}


def get_auth_token(creds):
    """Helper to get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    if response.status_code == 200:
        return response.json().get("token")
    return None


class TestAuthentication:
    """Test login for Super Admin and Principal"""
    
    def test_super_admin_login(self):
        """Super Admin should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        print(f"Super Admin login response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user" in data, "Response should contain user"
        assert "token" in data, "Response should contain token"
        assert data["user"]["role"] == "super_admin", "User should be super_admin"
        print(f"Super Admin logged in: {data['user']['name']}")
    
    def test_principal_login(self):
        """Principal should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PRINCIPAL_CREDS)
        print(f"Principal login response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user" in data, "Response should contain user"
        assert "token" in data, "Response should contain token"
        assert data["user"]["role"] == "principal", "User should be principal"
        print(f"Principal logged in: {data['user']['name']}")


class TestPrincipalDashboard:
    """Test Principal Dashboard APIs - should return real data from database"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as principal before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PRINCIPAL_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Principal login failed: {response.text}")
        data = response.json()
        self.token = data.get("token")
        self.user = data.get("user")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        print(f"Logged in as Principal: {self.user.get('name')}")
    
    def test_principal_snapshot_api(self):
        """Test /api/principal/snapshot returns real data"""
        response = requests.get(f"{BASE_URL}/api/principal/snapshot", headers=self.headers)
        print(f"Snapshot API response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Snapshot data: {data}")
        
        # Verify structure
        assert "totalStudents" in data, "Should have totalStudents"
        assert "testsThisMonth" in data, "Should have testsThisMonth"
        assert "averageScore" in data, "Should have averageScore"
        assert "atRiskCount" in data, "Should have atRiskCount"
        
        # Verify data types
        assert isinstance(data["totalStudents"], int), "totalStudents should be int"
        assert isinstance(data["testsThisMonth"], int), "testsThisMonth should be int"
        
        # According to task, test school has 2 students
        print(f"Total students in school: {data['totalStudents']}")
        assert data["totalStudents"] == 2, f"Expected 2 students, got {data['totalStudents']}"
    
    def test_principal_grade_performance_api(self):
        """Test /api/principal/grade-performance returns real data"""
        response = requests.get(f"{BASE_URL}/api/principal/grade-performance", headers=self.headers)
        print(f"Grade Performance API response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Grade Performance data: {data}")
        
        # Should be a list (can be empty if no exams yet)
        assert isinstance(data, list), "Should return a list"
        
        # If data exists, verify structure
        if len(data) > 0:
            item = data[0]
            assert "grade" in item, "Should have grade"
            assert "averageScore" in item, "Should have averageScore"
            assert "passPercentage" in item, "Should have passPercentage"
            assert "totalAttempts" in item, "Should have totalAttempts"
            assert "trend" in item, "Should have trend"
    
    def test_principal_subject_health_api(self):
        """Test /api/principal/subject-health returns real data"""
        response = requests.get(f"{BASE_URL}/api/principal/subject-health", headers=self.headers)
        print(f"Subject Health API response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Subject Health data: {data}")
        
        # Should be a list (can be empty if no exams yet)
        assert isinstance(data, list), "Should return a list"
        
        # If data exists, verify structure
        if len(data) > 0:
            item = data[0]
            assert "subject" in item, "Should have subject"
            assert "grade" in item, "Should have grade"
            assert "averagePercentage" in item, "Should have averagePercentage"
    
    def test_principal_at_risk_students_api(self):
        """Test /api/principal/at-risk-students returns real data"""
        response = requests.get(f"{BASE_URL}/api/principal/at-risk-students", headers=self.headers)
        print(f"At-Risk Students API response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"At-Risk Students data: {data}")
        
        # Should be a list (can be empty if no at-risk students)
        assert isinstance(data, list), "Should return a list"
        
        # If data exists, verify structure
        if len(data) > 0:
            item = data[0]
            assert "studentId" in item, "Should have studentId"
            assert "studentName" in item, "Should have studentName"
            assert "grade" in item, "Should have grade"
    
    def test_principal_risk_alerts_api(self):
        """Test /api/principal/risk-alerts returns real data"""
        response = requests.get(f"{BASE_URL}/api/principal/risk-alerts", headers=self.headers)
        print(f"Risk Alerts API response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Risk Alerts data: {data}")
        
        # Should be a list (can be empty if no alerts)
        assert isinstance(data, list), "Should return a list"
    
    def test_no_hardcoded_demo_data(self):
        """Verify no hardcoded names like 'Mr. Sharma' or 'Ms. Gupta' appear"""
        # Check at-risk students
        response = requests.get(f"{BASE_URL}/api/principal/at-risk-students", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        hardcoded_names = ["Mr. Sharma", "Ms. Gupta", "Sharma", "Gupta"]
        
        for student in data:
            name = student.get("studentName", "")
            for hardcoded in hardcoded_names:
                assert hardcoded.lower() not in name.lower(), f"Found hardcoded name '{hardcoded}' in at-risk students"
        
        # Check risk alerts
        response = requests.get(f"{BASE_URL}/api/principal/risk-alerts", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        for alert in data:
            name = alert.get("studentName", "")
            for hardcoded in hardcoded_names:
                assert hardcoded.lower() not in name.lower(), f"Found hardcoded name '{hardcoded}' in risk alerts"
        
        print("No hardcoded demo names found - data is from real database")


class TestReferenceMaterialsCRUD:
    """Test Reference Materials CRUD operations for Super Admin"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as super admin before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Super Admin login failed: {response.text}")
        data = response.json()
        self.token = data.get("token")
        self.user = data.get("user")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        print(f"Logged in as Super Admin: {self.user.get('name')}")
    
    def test_get_reference_materials_list(self):
        """Test GET /api/superadmin/reference-materials"""
        response = requests.get(f"{BASE_URL}/api/superadmin/reference-materials", headers=self.headers)
        print(f"Get Reference Materials response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"Found {len(data)} reference materials")
    
    def test_create_reference_material(self):
        """Test POST /api/superadmin/reference-materials"""
        material_data = {
            "title": "TEST_Math_Paper_2024",
            "description": "Test math question paper for Class 10",
            "grade": "10",
            "subject": "Mathematics",
            "category": "question_paper",
            "academicYear": "2024-25",
            "fileName": "test_math_paper.pdf",
            "fileSize": 1024,
            "mimeType": "application/pdf"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/superadmin/reference-materials",
            json=material_data,
            headers=self.headers
        )
        print(f"Create Reference Material response: {response.status_code}")
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["title"] == material_data["title"], "Title should match"
        assert data["grade"] == material_data["grade"], "Grade should match"
        print(f"Created reference material with ID: {data['id']}")
        
        return data["id"]
    
    def test_create_and_verify_persistence(self):
        """Test that created material persists in database"""
        # Create material
        material_data = {
            "title": "TEST_Physics_Paper_2024",
            "description": "Test physics question paper for Class 12",
            "grade": "12",
            "subject": "Physics",
            "category": "question_paper",
            "academicYear": "2024-25",
            "fileName": "test_physics_paper.pdf",
            "fileSize": 2048,
            "mimeType": "application/pdf"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/superadmin/reference-materials",
            json=material_data,
            headers=self.headers
        )
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        created = create_response.json()
        material_id = created["id"]
        
        # Verify by fetching list
        list_response = requests.get(f"{BASE_URL}/api/superadmin/reference-materials", headers=self.headers)
        assert list_response.status_code == 200
        materials = list_response.json()
        
        found = any(m["id"] == material_id for m in materials)
        assert found, f"Created material {material_id} not found in list"
        print(f"Verified material {material_id} persisted in database")
    
    def test_update_reference_material(self):
        """Test PATCH /api/superadmin/reference-materials/:id"""
        # First create a material
        material_data = {
            "title": "TEST_Chemistry_Paper_Original",
            "grade": "10",
            "subject": "Chemistry",
            "category": "question_paper",
            "fileName": "test_chem_paper.pdf"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/superadmin/reference-materials",
            json=material_data,
            headers=self.headers
        )
        assert create_response.status_code in [200, 201]
        created = create_response.json()
        material_id = created["id"]
        
        # Update the material
        update_data = {
            "title": "TEST_Chemistry_Paper_Updated",
            "description": "Updated description"
        }
        
        update_response = requests.patch(
            f"{BASE_URL}/api/superadmin/reference-materials/{material_id}",
            json=update_data,
            headers=self.headers
        )
        print(f"Update Reference Material response: {update_response.status_code}")
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        updated = update_response.json()
        assert updated["title"] == update_data["title"], "Title should be updated"
        print(f"Updated material {material_id} successfully")
    
    def test_delete_reference_material(self):
        """Test DELETE /api/superadmin/reference-materials/:id"""
        # First create a material
        material_data = {
            "title": "TEST_Biology_Paper_ToDelete",
            "grade": "12",
            "subject": "Biology",
            "category": "question_paper",
            "fileName": "test_bio_paper.pdf"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/superadmin/reference-materials",
            json=material_data,
            headers=self.headers
        )
        assert create_response.status_code in [200, 201]
        created = create_response.json()
        material_id = created["id"]
        
        # Delete the material
        delete_response = requests.delete(
            f"{BASE_URL}/api/superadmin/reference-materials/{material_id}",
            headers=self.headers
        )
        print(f"Delete Reference Material response: {delete_response.status_code}")
        assert delete_response.status_code in [200, 204], f"Expected 200/204, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify deletion by checking list
        list_response = requests.get(f"{BASE_URL}/api/superadmin/reference-materials", headers=self.headers)
        assert list_response.status_code == 200
        materials = list_response.json()
        
        # Material should not be in active list (soft delete)
        found = any(m["id"] == material_id and m.get("isActive", True) for m in materials)
        assert not found, f"Deleted material {material_id} should not be in active list"
        print(f"Deleted material {material_id} successfully")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Super Admin login failed: {response.text}")
        data = response.json()
        self.token = data.get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_cleanup_test_materials(self):
        """Clean up TEST_ prefixed materials"""
        response = requests.get(f"{BASE_URL}/api/superadmin/reference-materials", headers=self.headers)
        if response.status_code != 200:
            print("Could not fetch materials for cleanup")
            return
        
        materials = response.json()
        test_materials = [m for m in materials if m.get("title", "").startswith("TEST_")]
        
        for material in test_materials:
            delete_response = requests.delete(
                f"{BASE_URL}/api/superadmin/reference-materials/{material['id']}",
                headers=self.headers
            )
            if delete_response.status_code in [200, 204]:
                print(f"Cleaned up test material: {material['title']}")
        
        print(f"Cleaned up {len(test_materials)} test materials")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
