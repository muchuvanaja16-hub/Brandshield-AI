def register(client, email, company):
    return client.post('/api/auth/register',json={'company_name':company,'email':email,'password':'SafePassword123!'} )

def test_candidate_analysis_and_company_isolation(client):
    assert register(client,'a@company.test','Company A').status_code == 201
    r=client.post('/api/scans',json={'candidate':'hackxxcelerate.example','asset_type':'website','platform':'Manual submission'})
    assert r.status_code == 201, r.text
    threat_id=r.json()['threat']['id']
    assert r.json()['threat']['indicator_scores']
    assert client.get('/api/threats').json()['total'] == 1
    client.post('/api/auth/logout')
    assert register(client,'b@company.test','Company B').status_code == 201
    assert client.get('/api/threats').json()['total'] == 0
    assert client.get(f'/api/threats/{threat_id}').status_code == 404

def test_brand_profile_save_and_incident(client):
    register(client,'owner@org.test','Org')
    r=client.put('/api/companies/me/brand-profile',json={'official_name':'Org','official_domains':['https://org.example'],'alternative_names':['Org Group']})
    assert r.status_code == 200, r.text
    assert r.json()['official_domains'] == ['https://org.example']
    t=client.post('/api/scans',json={'candidate':'org-help.example','asset_type':'website'})
    assert t.status_code == 201
    tid=t.json()['threat']['id']
    i=client.post('/api/incidents',json={'title':'Review candidate','threat_id':tid,'severity':'High'})
    assert i.status_code == 201, i.text
    assert client.patch(f"/api/incidents/{i.json()['id']}",json={'status':'Resolved','resolution_notes':'Reviewed manually'}).json()['status']=='Resolved'

def test_invalid_status_rejected(client):
    register(client,'owner2@org.test','Org Two')
    t=client.post('/api/scans',json={'candidate':'something.example'})
    r=client.patch(f"/api/threats/{t.json()['threat']['id']}",json={'status':'Definitely Fraud'})
    assert r.status_code == 422

def test_dashboard_uses_persisted_data_and_root_serves_frontend(client):
    root=client.get('/')
    assert root.status_code == 200
    assert 'BrandShield' in root.text
    register(client,'dash@company.test','Dashboard Co')
    client.post('/api/scans',json={'candidate':'dashboard-help.example','asset_type':'website'})
    summary=client.get('/api/dashboard/summary')
    assert summary.status_code == 200
    assert summary.json()['total_assets'] == 1
    assert len(summary.json()['recent_threats']) == 1

def test_evidence_upload_and_company_scoped_download(client):
    register(client,'evidence@company.test','Evidence Co')
    t=client.post('/api/scans',json={'candidate':'evidence-help.example','asset_type':'website'})
    tid=t.json()['threat']['id']
    upload=client.post(f'/api/evidence?threat_id={tid}',files={'file':('proof.png',b'\x89PNG\r\n\x1a\n'+b'fake-demo-bytes','image/png')})
    assert upload.status_code == 201, upload.text
    url=upload.json()['download_url']
    assert client.get(url).status_code == 200
    client.post('/api/auth/logout')
    register(client,'other@company.test','Other Co')
    assert client.get(url).status_code == 404
