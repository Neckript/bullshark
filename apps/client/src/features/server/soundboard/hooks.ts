import { useSelector } from 'react-redux';
import { soundsSelector } from './selectors';

export const useSounds = () => useSelector(soundsSelector);
