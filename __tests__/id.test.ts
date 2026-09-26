import { generateId } from '../src/utils/id';

describe('generateId', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gera um identificador com timestamp e sufixo aleatorio', () => {
    jest.spyOn(Date, 'now').mockReturnValue(36);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(generateId()).toBe('10-i');
  });
});
