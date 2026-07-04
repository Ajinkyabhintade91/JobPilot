"""Pure scoring math: keyword hits, recency decay, and the blended score."""
from jobpilot_worker.scoring import blend_score, recency_factor, title_keyword_hit

QUERIES = [
    {"role_family": "fullstack", "keywords": "full stack developer"},
    {"role_family": "ai_ml", "keywords": "machine learning engineer LLM"},
]


def test_exact_keyword_title_hits_full():
    assert title_keyword_hit("Senior Full Stack Developer (Remote)", QUERIES) == 1.0


def test_partial_keyword_overlap_is_fractional():
    # "full" + "stack" match, "developer" doesn't -> 2/3
    assert abs(title_keyword_hit("Full Stack Engineer", QUERIES) - 2 / 3) < 1e-9


def test_best_query_wins():
    # matches the ai_ml query far better than fullstack
    assert title_keyword_hit("Machine Learning Engineer", QUERIES) >= 0.75


def test_unrelated_title_scores_zero():
    assert title_keyword_hit("Accountant", QUERIES) == 0.0


def test_no_queries_is_neutral_not_zero():
    # without configured queries the component shouldn't drag scores down
    assert title_keyword_hit("Anything", []) == 0.5


def test_recency_decays():
    assert recency_factor(2) == 1.0
    assert recency_factor(20) == 0.6
    assert recency_factor(90) == 0.2
    assert recency_factor(None) == 0.3


def test_blend_perfect_inputs_hit_100():
    score, breakdown = blend_score(similarity=0.80, title_hit=1.0, recency=1.0)
    assert score == 100
    assert breakdown["similarity"] == 0.8


def test_blend_floor_similarity_scores_low():
    score, _ = blend_score(similarity=0.30, title_hit=0.0, recency=0.2)
    assert score <= 5


def test_blend_is_bounded():
    for sim in (-1.0, 0.0, 0.5, 1.0, 2.0):
        score, _ = blend_score(similarity=sim, title_hit=1.0, recency=1.0)
        assert 0 <= score <= 100
