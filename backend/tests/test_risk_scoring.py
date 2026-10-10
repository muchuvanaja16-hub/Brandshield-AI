from app.services.risk_scoring import normalize_name, similarity, extract_host, analyze_candidate

def test_name_similarity_detects_small_variations():
    assert normalize_name('Hack-Xcelerate!') == 'hackxcelerate'
    assert similarity('hackxcelerate','hackxxcelerate') >= 85

def test_domain_parser_extracts_hostname():
    assert extract_host('https://sub.example.com/path') == 'sub.example.com'
    assert extract_host('brand.example') == 'brand.example'

def test_risk_score_has_explanation_and_bounds():
    result=analyze_candidate('hackxcelerate-offers.example','website',{'official_name':'HackXcelerate','alternative_names':[],'official_website':'https://hackxcelerate.example','official_domains':['hackxcelerate.example'],'verification_status':'unverified'})
    assert 0 <= result['risk_score'] <= 100
    assert result['risk_category'] in {'Low','Medium','High','Critical'}
    assert result['reasons']
    assert result['limitations']

def test_missing_brand_data_does_not_crash():
    result=analyze_candidate('unrelated.example','website',{'official_name':'','alternative_names':[],'official_domains':[]})
    assert result['risk_score'] >= 0
