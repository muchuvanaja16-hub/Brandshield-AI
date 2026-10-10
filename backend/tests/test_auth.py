from app.security import hash_password, verify_password

def test_password_hashing_is_salted_and_verifiable():
    first = hash_password('CorrectHorse42!')
    second = hash_password('CorrectHorse42!')
    assert first != second
    assert verify_password('CorrectHorse42!', first)
    assert not verify_password('wrong-password', first)

def test_register_login_and_me(client):
    r = client.post('/api/auth/register', json={'company_name':'Acme Security','industry':'Technology','website':'https://acme.example','email':'owner@acme.test','password':'SafePassword123!'})
    assert r.status_code == 201, r.text
    assert r.json()['company']['name'] == 'Acme Security'
    assert client.get('/api/auth/me').status_code == 200
    client.post('/api/auth/logout')
    assert client.get('/api/auth/me').status_code == 401
    r = client.post('/api/auth/login', json={'email':'owner@acme.test','password':'SafePassword123!'})
    assert r.status_code == 200
    assert client.get('/api/auth/me').status_code == 200

def test_duplicate_registration_rejected(client):
    payload={'company_name':'Acme One','email':'same@acme.test','password':'SafePassword123!'}
    assert client.post('/api/auth/register',json=payload).status_code == 201
    payload['company_name']='Acme Two'
    assert client.post('/api/auth/register',json=payload).status_code == 409

def test_unauthorized_api_rejected(client):
    assert client.get('/api/dashboard/summary').status_code == 401
