const specialTokens = {
  userMsgUserContentXmlTag: 'user-msg',
  userMsgAttachmentXmlTag: 'attach',
  userMsgCompressedHistoryXmlTag: 'compressed-history',
  environmentChangesXmlTag: 'env-changes',
  truncated: (count?: number, type: 'line' | 'char' | 'file' = 'line') =>
    `{{[TRUNCATED${count ? `${count} ${type}${count > 1 ? 's' : ''}` : ''}]}}`,
};

export default specialTokens;
