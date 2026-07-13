/**
 * Express JSON body parser에 전달할 최대 요청 본문 크기.
 * notice_text(10,000자)와 parent_input_text(4,000자) 등을 여유 있게 수용하되
 * 비정상적으로 큰 payload는 차단한다.
 */
export const MAX_REQUEST_BODY_SIZE = '512kb';
