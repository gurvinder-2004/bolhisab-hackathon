import { makeGstin } from '../engine/index.js';

// Everything here is made up.
export const BUSINESS = {
  name: 'Sharma Packaging',
  ownerName: 'Rakesh Sharma',
  address: 'Plot 14, Bhosari MIDC, Pune, Maharashtra 411026',
  stateCode: '27',
  gstin: makeGstin('27AAKFS4821R1Z'),
  registrationType: 'regular',
  turnoverPaise: 3_200_000_000, // Rs 3.2 crore (below the Rs 5 crore e-invoicing line)
  udyamRegistered: true,
  bankName: 'Sample Cooperative Bank',
  bankAccount: '000123456789',
  bankIfsc: 'SAMP0000123',
  upiId: 'sharmapackaging@samplebank',
  cashBalancePaise: 45_000_000, // Rs 4,50,000
  safetyBufferPaise: 15_000_000, // Rs 1,50,000
};
