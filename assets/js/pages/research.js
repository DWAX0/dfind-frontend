/* 06 연구·과제: 임상시험 승인 · 임상시험 승인 정보공개 (뉴스는 '뉴스' 메뉴에서 따로 봄. 논문·NTIS 는 수집 준비 중) */
D.categoryPage({
  page: 'research', category: 'research', title: '연구·과제', defaultPer: '30',
  sub: '임상시험 승인으로 기술 단계를 봅니다 (승인일 기준)',
  notice: '임상시험은 이머디에서 매일 수집합니다. R&D 과제(NTIS)와 학술 논문(PubMed) 수집은 준비 중입니다. R&D·논문 관련 기사는 뉴스 메뉴에 있습니다.',
  only: function (f) { return !/^news:/.test(f.item_key); },
  kinds: ['임상시험 승인', '임상시험 승인 정보공개'],
  kindNotes: { '임상시험 승인': '이머디 · 키워드 맞는 것만', '임상시험 승인 정보공개': '이머디 게시판' },
  searchHint: '기업·제품·제목·첨부 내용', emptyText: '이 기간에 연구·과제 소식이 없습니다.'
});
