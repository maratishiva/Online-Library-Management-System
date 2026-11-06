import os
import time
import unittest
from datetime import date, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

class LibrarySystemTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        options = webdriver.ChromeOptions()
        if os.getenv("HEADLESS", "true").lower() == "true":
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 10)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def login(self):
        self.driver.get(BASE_URL)
        self.wait.until(EC.visibility_of_element_located((By.ID, "username")))
        self.driver.find_element(By.ID, "username").send_keys(ADMIN_USER)
        self.driver.find_element(By.ID, "password").send_keys(ADMIN_PASSWORD)
        self.driver.find_element(By.ID, "loginBtn").click()
        self.wait.until(EC.visibility_of_element_located((By.ID, "dashboard")))

    def test_TC01_admin_login(self):
        self.login()
        self.assertTrue(self.driver.find_element(By.ID, "dashboard").is_displayed())

    def test_TC02_add_new_book(self):
        self.login()
        unique_title = f"Selenium Test Book {int(time.time())}"
        self.driver.find_element(By.ID, "bookTitle").send_keys(unique_title)
        self.driver.find_element(By.ID, "author").send_keys("Test Author")
        self.driver.find_element(By.ID, "isbn").send_keys(str(int(time.time()))[-13:])
        self.driver.find_element(By.ID, "totalCopies").clear()
        self.driver.find_element(By.ID, "totalCopies").send_keys("2")
        self.driver.find_element(By.ID, "saveBook").click()
        self.wait.until(lambda d: unique_title in d.find_element(By.ID, "booksTable").text)
        self.assertIn(unique_title, self.driver.find_element(By.ID, "booksTable").text)

    def test_TC03_search_book(self):
        self.login()
        self.driver.find_element(By.ID, "searchBook").send_keys("The Alchemist")
        self.driver.find_element(By.ID, "searchBtn").click()
        self.wait.until(lambda d: "The Alchemist" in d.find_element(By.ID, "booksTable").text)
        self.assertIn("The Alchemist", self.driver.find_element(By.ID, "booksTable").text)

    def test_TC04_update_book(self):
        self.login()
        self.driver.find_element(By.ID, "searchBook").send_keys("The Alchemist")
        self.driver.find_element(By.ID, "searchBtn").click()
        self.wait.until(lambda d: "The Alchemist" in d.find_element(By.ID, "booksTable").text)
        self.driver.find_element(By.CSS_SELECTOR, "#booksTable button[data-edit]").click()
        title = self.driver.find_element(By.ID, "bookTitle")
        title.clear()
        title.send_keys("The Alchemist Updated")
        self.driver.find_element(By.ID, "saveBook").click()
        self.wait.until(lambda d: "The Alchemist Updated" in d.find_element(By.ID, "booksTable").text)
        self.assertIn("The Alchemist Updated", self.driver.find_element(By.ID, "booksTable").text)

    def test_TC05_student_registration_and_issue(self):
        self.login()
        suffix = str(int(time.time()))
        self.driver.find_element(By.CSS_SELECTOR, '[data-tab="studentsPanel"]').click()
        self.driver.find_element(By.ID, "studentName").send_keys("Selenium Student")
        self.driver.find_element(By.ID, "studentEmail").send_keys(f"selenium{suffix}@example.com")
        self.driver.find_element(By.ID, "studentNo").send_keys(f"ST{suffix}")
        self.driver.find_element(By.CSS_SELECTOR, "#studentForm button[type=submit]").click()
        self.wait.until(lambda d: "Selenium Student" in d.find_element(By.ID, "studentsTable").text)

        self.driver.find_element(By.CSS_SELECTOR, '[data-tab="loansPanel"]').click()
        self.wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#issueBook option")) > 1)
        self.driver.find_element(By.ID, "issueBook").click()
        self.driver.find_element(By.CSS_SELECTOR, "#issueBook option:nth-child(2)").click()
        self.driver.find_element(By.ID, "issueStudent").click()
        self.driver.find_element(By.CSS_SELECTOR, "#issueStudent option:nth-child(2)").click()
        self.driver.find_element(By.ID, "dueDate").send_keys((date.today() + timedelta(days=7)).isoformat())
        self.driver.find_element(By.CSS_SELECTOR, "#issueForm button[type=submit]").click()
        self.wait.until(lambda d: "ISSUED" in d.find_element(By.ID, "loansTable").text)
        self.assertIn("ISSUED", self.driver.find_element(By.ID, "loansTable").text)

    def test_TC06_return_book(self):
        self.login()
        self.driver.find_element(By.CSS_SELECTOR, '[data-tab="loansPanel"]').click()
        self.wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "#loansTable button[data-return]"))
        self.driver.find_element(By.CSS_SELECTOR, "#loansTable button[data-return]").click()
        self.wait.until(lambda d: "RETURNED" in d.find_element(By.ID, "loansTable").text)
        self.assertIn("RETURNED", self.driver.find_element(By.ID, "loansTable").text)

    def test_TC07_search_unavailable_book(self):
        self.login()
        self.driver.find_element(By.ID, "searchBook").send_keys("No Such Library Book XYZ")
        self.driver.find_element(By.ID, "searchBtn").click()
        self.wait.until(lambda d: "No matching books found." in d.find_element(By.ID, "emptyBooks").text)
        self.assertIn("No matching books found.", self.driver.find_element(By.ID, "emptyBooks").text)

if __name__ == "__main__":
    unittest.main(verbosity=2)
