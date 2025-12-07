#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Store Inventory Reorder Level Tracker
Tests all backend APIs in the specified order from the review request.
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = "https://stocktracker-186.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Global variables to store test data
auth_token = None
user_data = None
downtown_store_id = None
uptown_store_id = None
laptop_item_id = None
mouse_item_id = None
keyboard_item_id = None
monitor_item_id = None

def print_test_result(test_name, success, details=""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    Details: {details}")
    print()

def make_request(method, endpoint, data=None, headers=None, expect_json=True):
    """Make HTTP request with error handling"""
    url = f"{API_BASE}{endpoint}"
    
    # Add auth header if token exists
    if auth_token and headers is None:
        headers = {"Authorization": f"Bearer {auth_token}"}
    elif auth_token and headers:
        headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        
        print(f"    Request: {method} {url}")
        print(f"    Status: {response.status_code}")
        
        if expect_json:
            try:
                response_data = response.json()
                print(f"    Response: {json.dumps(response_data, indent=2)}")
                return response.status_code, response_data
            except:
                print(f"    Response (text): {response.text}")
                return response.status_code, response.text
        else:
            print(f"    Response (text): {response.text[:200]}...")
            return response.status_code, response.text
            
    except Exception as e:
        print(f"    Error: {str(e)}")
        return None, str(e)

def test_authentication():
    """Test user registration, login, and token verification"""
    global auth_token, user_data
    
    print("=== 1. AUTHENTICATION TESTS ===")
    
    # Test user registration
    print("Testing user registration...")
    register_data = {
        "username": "testmanager",
        "password": "test123",
        "role": "manager"
    }
    
    status, response = make_request("POST", "/auth/register", register_data, headers={})
    
    if status == 200 and "token" in response:
        auth_token = response["token"]
        user_data = response["user"]
        print_test_result("User Registration", True, f"User created: {user_data['username']}, Role: {user_data['role']}")
    else:
        print_test_result("User Registration", False, f"Status: {status}, Response: {response}")
        return False
    
    # Test login with created user
    print("Testing user login...")
    login_data = {
        "username": "testmanager",
        "password": "test123"
    }
    
    status, response = make_request("POST", "/auth/login", login_data, headers={})
    
    if status == 200 and "token" in response:
        auth_token = response["token"]  # Update token
        print_test_result("User Login", True, f"Login successful, token received")
    else:
        print_test_result("User Login", False, f"Status: {status}, Response: {response}")
        return False
    
    # Test GET /api/auth/me
    print("Testing token verification...")
    status, response = make_request("GET", "/auth/me")
    
    if status == 200 and "user" in response:
        print_test_result("Token Verification", True, f"User verified: {response['user']['username']}")
    else:
        print_test_result("Token Verification", False, f"Status: {status}, Response: {response}")
        return False
    
    return True

def test_store_management():
    """Test store creation and retrieval"""
    global downtown_store_id, uptown_store_id
    
    print("=== 2. STORE MANAGEMENT TESTS ===")
    
    # Create Downtown Store
    print("Creating Downtown Store...")
    store_data = {
        "name": "Downtown Store",
        "location": "123 Main St",
        "contactEmail": "downtown@test.com",
        "contactPhone": "555-0101"
    }
    
    status, response = make_request("POST", "/stores", store_data)
    
    if status == 200 and "store" in response:
        downtown_store_id = response["store"]["id"]
        print_test_result("Create Downtown Store", True, f"Store ID: {downtown_store_id}")
    else:
        print_test_result("Create Downtown Store", False, f"Status: {status}, Response: {response}")
        return False
    
    # Create Uptown Store
    print("Creating Uptown Store...")
    store_data = {
        "name": "Uptown Store",
        "location": "456 Oak Ave",
        "contactEmail": "uptown@test.com",
        "contactPhone": "555-0102"
    }
    
    status, response = make_request("POST", "/stores", store_data)
    
    if status == 200 and "store" in response:
        uptown_store_id = response["store"]["id"]
        print_test_result("Create Uptown Store", True, f"Store ID: {uptown_store_id}")
    else:
        print_test_result("Create Uptown Store", False, f"Status: {status}, Response: {response}")
        return False
    
    # Get all stores
    print("Getting all stores...")
    status, response = make_request("GET", "/stores")
    
    if status == 200 and "stores" in response and len(response["stores"]) >= 2:
        store_names = [store["name"] for store in response["stores"]]
        print_test_result("Get All Stores", True, f"Found stores: {store_names}")
    else:
        print_test_result("Get All Stores", False, f"Status: {status}, Response: {response}")
        return False
    
    return True

def test_inventory_management():
    """Test inventory item creation and retrieval with filters"""
    global laptop_item_id, mouse_item_id, keyboard_item_id, monitor_item_id
    
    print("=== 3. INVENTORY MANAGEMENT TESTS ===")
    
    # Create inventory items in Downtown Store
    print("Creating inventory items in Downtown Store...")
    
    # LAPTOP001 - Normal stock
    laptop_data = {
        "sku": "LAPTOP001",
        "productName": "Dell Laptop",
        "currentQuantity": 15,
        "reorderLevel": 10,
        "unitCost": 899.99,
        "storeId": downtown_store_id
    }
    
    status, response = make_request("POST", "/inventory", laptop_data)
    if status == 200 and "item" in response:
        laptop_item_id = response["item"]["id"]
        print_test_result("Create LAPTOP001", True, f"Item ID: {laptop_item_id}")
    else:
        print_test_result("Create LAPTOP001", False, f"Status: {status}, Response: {response}")
        return False
    
    # MOUSE001 - Low stock (should trigger alert)
    mouse_data = {
        "sku": "MOUSE001",
        "productName": "Wireless Mouse",
        "currentQuantity": 5,
        "reorderLevel": 10,
        "unitCost": 29.99,
        "storeId": downtown_store_id
    }
    
    status, response = make_request("POST", "/inventory", mouse_data)
    if status == 200 and "item" in response:
        mouse_item_id = response["item"]["id"]
        print_test_result("Create MOUSE001 (Low Stock)", True, f"Item ID: {mouse_item_id}")
    else:
        print_test_result("Create MOUSE001 (Low Stock)", False, f"Status: {status}, Response: {response}")
        return False
    
    # KEYBOARD001 - Normal stock
    keyboard_data = {
        "sku": "KEYBOARD001",
        "productName": "Mechanical Keyboard",
        "currentQuantity": 20,
        "reorderLevel": 5,
        "unitCost": 129.99,
        "storeId": downtown_store_id
    }
    
    status, response = make_request("POST", "/inventory", keyboard_data)
    if status == 200 and "item" in response:
        keyboard_item_id = response["item"]["id"]
        print_test_result("Create KEYBOARD001", True, f"Item ID: {keyboard_item_id}")
    else:
        print_test_result("Create KEYBOARD001", False, f"Status: {status}, Response: {response}")
        return False
    
    # Create inventory item in Uptown Store
    print("Creating inventory item in Uptown Store...")
    
    # MONITOR001 - Low stock (should trigger alert)
    monitor_data = {
        "sku": "MONITOR001",
        "productName": "4K Monitor",
        "currentQuantity": 3,
        "reorderLevel": 8,
        "unitCost": 499.99,
        "storeId": uptown_store_id
    }
    
    status, response = make_request("POST", "/inventory", monitor_data)
    if status == 200 and "item" in response:
        monitor_item_id = response["item"]["id"]
        print_test_result("Create MONITOR001 (Low Stock)", True, f"Item ID: {monitor_item_id}")
    else:
        print_test_result("Create MONITOR001 (Low Stock)", False, f"Status: {status}, Response: {response}")
        return False
    
    # Test GET /api/inventory (all items)
    print("Getting all inventory items...")
    status, response = make_request("GET", "/inventory")
    
    if status == 200 and "items" in response and len(response["items"]) >= 4:
        item_skus = [item["sku"] for item in response["items"]]
        print_test_result("Get All Inventory", True, f"Found items: {item_skus}")
    else:
        print_test_result("Get All Inventory", False, f"Status: {status}, Response: {response}")
        return False
    
    # Test search filter
    print("Testing search filter...")
    status, response = make_request("GET", "/inventory?search=laptop")
    
    if status == 200 and "items" in response:
        found_laptop = any(item["sku"] == "LAPTOP001" for item in response["items"])
        print_test_result("Search Filter (laptop)", found_laptop, f"Found {len(response['items'])} items")
    else:
        print_test_result("Search Filter (laptop)", False, f"Status: {status}, Response: {response}")
    
    # Test store filter
    print("Testing store filter...")
    status, response = make_request("GET", f"/inventory?storeId={downtown_store_id}")
    
    if status == 200 and "items" in response:
        downtown_items = [item["sku"] for item in response["items"]]
        expected_items = ["LAPTOP001", "MOUSE001", "KEYBOARD001"]
        all_found = all(sku in downtown_items for sku in expected_items)
        print_test_result("Store Filter (Downtown)", all_found, f"Found items: {downtown_items}")
    else:
        print_test_result("Store Filter (Downtown)", False, f"Status: {status}, Response: {response}")
    
    # Test low stock filter
    print("Testing low stock filter...")
    status, response = make_request("GET", "/inventory?lowStock=true")
    
    if status == 200 and "items" in response:
        low_stock_skus = [item["sku"] for item in response["items"]]
        expected_low_stock = ["MOUSE001", "MONITOR001"]  # Both have qty <= reorder level
        found_expected = all(sku in low_stock_skus for sku in expected_low_stock)
        print_test_result("Low Stock Filter", found_expected, f"Found low stock items: {low_stock_skus}")
    else:
        print_test_result("Low Stock Filter", False, f"Status: {status}, Response: {response}")
    
    return True

def test_automatic_alerts():
    """Test automatic alert system"""
    print("=== 4. AUTOMATIC ALERT SYSTEM TESTS ===")
    
    # Get unresolved alerts
    print("Getting unresolved alerts...")
    status, response = make_request("GET", "/alerts?resolved=false")
    
    if status == 200 and "alerts" in response:
        alert_skus = [alert["sku"] for alert in response["alerts"]]
        expected_alerts = ["MOUSE001", "MONITOR001"]  # Both should have alerts
        found_expected = all(sku in alert_skus for sku in expected_alerts)
        print_test_result("Auto-Generated Alerts", found_expected, 
                         f"Found alerts for: {alert_skus}, Expected: {expected_alerts}")
        
        # Verify alert details
        for alert in response["alerts"]:
            if alert["sku"] in expected_alerts:
                is_valid = (alert["currentQuantity"] <= alert["reorderLevel"] and 
                           not alert["resolved"] and 
                           alert["alertType"] == "reorder")
                print_test_result(f"Alert Details for {alert['sku']}", is_valid,
                                f"Qty: {alert['currentQuantity']}, Reorder: {alert['reorderLevel']}")
    else:
        print_test_result("Auto-Generated Alerts", False, f"Status: {status}, Response: {response}")
        return False
    
    return True

def test_inventory_adjustments():
    """Test inventory adjustments and alert auto-resolution"""
    print("=== 5. INVENTORY ADJUSTMENTS TESTS ===")
    
    # Adjust MOUSE001: Add +10 items (should resolve alert)
    print("Adjusting MOUSE001 inventory (+10 items)...")
    adjust_data = {
        "itemId": mouse_item_id,
        "quantityChange": 10,
        "changeType": "reorder",
        "notes": "Restock from supplier"
    }
    
    status, response = make_request("POST", "/inventory/adjust", adjust_data)
    
    if status == 200:
        print_test_result("Adjust MOUSE001 (+10)", True, 
                         f"Previous: {response['previousQty']}, New: {response['newQty']}")
    else:
        print_test_result("Adjust MOUSE001 (+10)", False, f"Status: {status}, Response: {response}")
        return False
    
    # Check if MOUSE001 alert was auto-resolved
    print("Checking if MOUSE001 alert was auto-resolved...")
    status, response = make_request("GET", "/alerts?resolved=false")
    
    if status == 200 and "alerts" in response:
        mouse_alerts = [alert for alert in response["alerts"] if alert["sku"] == "MOUSE001"]
        alert_resolved = len(mouse_alerts) == 0
        print_test_result("MOUSE001 Alert Auto-Resolved", alert_resolved,
                         f"Unresolved MOUSE001 alerts: {len(mouse_alerts)}")
    else:
        print_test_result("MOUSE001 Alert Auto-Resolved", False, f"Status: {status}, Response: {response}")
    
    # Adjust LAPTOP001: Subtract -8 items (should trigger new alert)
    print("Adjusting LAPTOP001 inventory (-8 items)...")
    adjust_data = {
        "itemId": laptop_item_id,
        "quantityChange": -8,
        "changeType": "sale",
        "notes": "Bulk sale to corporate client"
    }
    
    status, response = make_request("POST", "/inventory/adjust", adjust_data)
    
    if status == 200:
        new_qty = response["newQty"]
        should_trigger_alert = new_qty <= 10  # reorder level is 10
        print_test_result("Adjust LAPTOP001 (-8)", True, 
                         f"Previous: {response['previousQty']}, New: {new_qty}, Should trigger alert: {should_trigger_alert}")
    else:
        print_test_result("Adjust LAPTOP001 (-8)", False, f"Status: {status}, Response: {response}")
        return False
    
    # Check if new alert was created for LAPTOP001
    print("Checking if new alert was created for LAPTOP001...")
    status, response = make_request("GET", "/alerts?resolved=false")
    
    if status == 200 and "alerts" in response:
        laptop_alerts = [alert for alert in response["alerts"] if alert["sku"] == "LAPTOP001"]
        new_alert_created = len(laptop_alerts) > 0
        print_test_result("LAPTOP001 New Alert Created", new_alert_created,
                         f"LAPTOP001 alerts found: {len(laptop_alerts)}")
    else:
        print_test_result("LAPTOP001 New Alert Created", False, f"Status: {status}, Response: {response}")
    
    return True

def test_dashboard_stats():
    """Test dashboard statistics"""
    print("=== 6. DASHBOARD STATISTICS TESTS ===")
    
    print("Getting dashboard stats...")
    status, response = make_request("GET", "/dashboard/stats")
    
    if status == 200 and "stats" in response:
        stats = response["stats"]
        
        # Verify expected values
        expected_items = 4
        expected_stores = 2
        expected_min_alerts = 2  # At least MONITOR001 and LAPTOP001
        
        items_correct = stats["totalItems"] == expected_items
        stores_correct = stats["totalStores"] == expected_stores
        alerts_correct = stats["activeAlerts"] >= expected_min_alerts
        has_total_value = "totalValue" in stats and float(stats["totalValue"]) > 0
        has_low_stock_count = "lowStockCount" in stats and stats["lowStockCount"] >= 2
        
        print_test_result("Dashboard Stats - Total Items", items_correct, 
                         f"Expected: {expected_items}, Got: {stats['totalItems']}")
        print_test_result("Dashboard Stats - Total Stores", stores_correct,
                         f"Expected: {expected_stores}, Got: {stats['totalStores']}")
        print_test_result("Dashboard Stats - Active Alerts", alerts_correct,
                         f"Expected: >={expected_min_alerts}, Got: {stats['activeAlerts']}")
        print_test_result("Dashboard Stats - Total Value", has_total_value,
                         f"Total Value: ${stats['totalValue']}")
        print_test_result("Dashboard Stats - Low Stock Count", has_low_stock_count,
                         f"Low Stock Count: {stats['lowStockCount']}")
        
        return items_correct and stores_correct and alerts_correct and has_total_value and has_low_stock_count
    else:
        print_test_result("Dashboard Statistics", False, f"Status: {status}, Response: {response}")
        return False

def test_csv_export():
    """Test CSV export functionality"""
    print("=== 7. CSV EXPORT TESTS ===")
    
    print("Testing CSV export...")
    status, response = make_request("GET", "/inventory/export", expect_json=False)
    
    if status == 200:
        # Check if response looks like CSV
        lines = response.split('\n')
        has_header = len(lines) > 0 and 'SKU' in lines[0]
        has_data = len(lines) > 1
        
        # Check for expected SKUs in CSV
        csv_content = response.upper()
        expected_skus = ["LAPTOP001", "MOUSE001", "KEYBOARD001", "MONITOR001"]
        skus_found = [sku for sku in expected_skus if sku in csv_content]
        
        print_test_result("CSV Export - Format", has_header and has_data,
                         f"Lines: {len(lines)}, Has header: {has_header}")
        print_test_result("CSV Export - Data", len(skus_found) == len(expected_skus),
                         f"Found SKUs: {skus_found}")
        
        return has_header and has_data and len(skus_found) == len(expected_skus)
    else:
        print_test_result("CSV Export", False, f"Status: {status}, Response: {response}")
        return False

def test_edge_cases():
    """Test edge cases and error conditions"""
    print("=== 8. EDGE CASES TESTS ===")
    
    # Test duplicate SKU in same store
    print("Testing duplicate SKU creation...")
    duplicate_data = {
        "sku": "LAPTOP001",  # Already exists in downtown store
        "productName": "Another Laptop",
        "currentQuantity": 5,
        "reorderLevel": 3,
        "unitCost": 999.99,
        "storeId": downtown_store_id
    }
    
    status, response = make_request("POST", "/inventory", duplicate_data)
    duplicate_rejected = status == 409  # Conflict status
    print_test_result("Duplicate SKU Rejection", duplicate_rejected,
                     f"Status: {status}, Expected: 409")
    
    # Test adjusting inventory below zero
    print("Testing negative inventory adjustment...")
    negative_adjust = {
        "itemId": keyboard_item_id,
        "quantityChange": -100,  # More than current quantity
        "changeType": "adjustment",
        "notes": "Test negative adjustment"
    }
    
    status, response = make_request("POST", "/inventory/adjust", negative_adjust)
    negative_rejected = status == 400  # Bad request
    print_test_result("Negative Inventory Rejection", negative_rejected,
                     f"Status: {status}, Expected: 400")
    
    # Test accessing protected route without token
    print("Testing unauthorized access...")
    status, response = make_request("GET", "/inventory", headers={})
    unauthorized_rejected = status == 401
    print_test_result("Unauthorized Access Rejection", unauthorized_rejected,
                     f"Status: {status}, Expected: 401")
    
    return duplicate_rejected and negative_rejected and unauthorized_rejected

def main():
    """Run all backend tests"""
    print("Starting Comprehensive Backend API Testing")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print("=" * 60)
    
    test_results = []
    
    # Run all tests in order
    test_results.append(("Authentication", test_authentication()))
    test_results.append(("Store Management", test_store_management()))
    test_results.append(("Inventory Management", test_inventory_management()))
    test_results.append(("Automatic Alerts", test_automatic_alerts()))
    test_results.append(("Inventory Adjustments", test_inventory_adjustments()))
    test_results.append(("Dashboard Statistics", test_dashboard_stats()))
    test_results.append(("CSV Export", test_csv_export()))
    test_results.append(("Edge Cases", test_edge_cases()))
    
    # Print final summary
    print("\n" + "=" * 60)
    print("FINAL TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall Result: {passed}/{total} test suites passed")
    
    if passed == total:
        print("🎉 ALL BACKEND TESTS PASSED!")
        return True
    else:
        print("⚠️  Some tests failed. Check details above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)