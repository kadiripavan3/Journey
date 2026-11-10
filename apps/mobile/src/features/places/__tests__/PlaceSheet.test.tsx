import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { onPhone } from '@/test/phone';

import { placeAt, placeHere, searchPlaces } from '../lookup';
import { PlaceSheet } from '../PlaceSheet';

jest.mock('../lookup', () => {
  class LocationDenied extends Error {}
  return { canLocate: true, LocationDenied, searchPlaces: jest.fn(), placeHere: jest.fn(), placeAt: jest.fn() };
});

const search = jest.mocked(searchPlaces);
const here = jest.mocked(placeHere);
const at = jest.mocked(placeAt);

beforeEach(() => jest.clearAllMocks());

describe('PlaceSheet', () => {
  it('finds a place by name and hands it back at city level, never exact by itself', async () => {
    search.mockResolvedValue([{ name: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33 }]);
    const onChange = jest.fn();
    const onClose = jest.fn();
    await render(onPhone(<PlaceSheet visible onClose={onClose} value={null} onChange={onChange} />));

    fireEvent.changeText(screen.getByLabelText('Search for a place'), 'hoi');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hoi An, Vietnam' })).toBeOnTheScreen());
    expect(search).toHaveBeenCalledWith('hoi');
    await userEvent.setup().press(screen.getByRole('button', { name: 'Hoi An, Vietnam' }));
    expect(onChange).toHaveBeenCalledWith({ name: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33, exact: false });
    expect(onClose).toHaveBeenCalled();
  });

  it('takes a name as it was typed when the search finds nothing, without a spot on the map', async () => {
    search.mockResolvedValue([]);
    const onChange = jest.fn();
    await render(onPhone(<PlaceSheet visible onClose={() => {}} value={null} onChange={onChange} />));
    fireEvent.changeText(screen.getByLabelText('Search for a place'), 'the long way round');
    await userEvent.setup().press(await screen.findByRole('button', { name: /^Use "The Long Way Round"/ }));
    expect(onChange).toHaveBeenCalledWith({ name: 'The Long Way Round', exact: false });
  });

  it('only asks the phone where it is when the person taps for it', async () => {
    here.mockResolvedValue({ name: 'Vík, Iceland', lat: 63.42, lng: -19.01 });
    const onChange = jest.fn();
    await render(onPhone(<PlaceSheet visible onClose={() => {}} value={null} onChange={onChange} />));
    expect(here).not.toHaveBeenCalled();
    await userEvent.setup().press(screen.getByRole('button', { name: /^Where you are now/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ name: 'Vík, Iceland', lat: 63.42, lng: -19.01, exact: false }));
  });

  it('offers where the first photo was taken, and can take the place away again', async () => {
    at.mockResolvedValue({ name: 'Hanoi, Vietnam', lat: 21.03, lng: 105.85 });
    const onChange = jest.fn();
    const user = userEvent.setup();
    const view = await render(onPhone(<PlaceSheet visible onClose={() => {}} value={null} onChange={onChange} photoPoint={{ lat: 21.03, lng: 105.85 }} />));
    expect(screen.queryByRole('button', { name: 'Remove the place' })).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Where the first photo was taken' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ name: 'Hanoi, Vietnam', lat: 21.03, lng: 105.85, exact: false }));
    expect(at).toHaveBeenCalledWith(21.03, 105.85);

    await view.rerender(onPhone(<PlaceSheet visible onClose={() => {}} value={{ name: 'Hanoi, Vietnam', lat: 21.03, lng: 105.85, exact: false }} onChange={onChange} />));
    await user.press(screen.getByRole('button', { name: 'Remove the place' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('says so when the phone cannot tell where a photo was taken', async () => {
    at.mockResolvedValue(null);
    await render(onPhone(<PlaceSheet visible onClose={() => {}} value={null} onChange={() => {}} photoPoint={{ lat: 1, lng: 2 }} />));
    await userEvent.setup().press(screen.getByRole('button', { name: 'Where the first photo was taken' }));
    expect(await screen.findByText("We couldn't tell where that photo was taken. Search for the place instead.")).toBeOnTheScreen();
  });
});
